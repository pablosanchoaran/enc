#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { MyInvestorAPI, MyInvestorAuthenticator, Auth } = require("miai-api");

// Session state: auth token persisted in memory during the server's lifetime
let currentAuth: typeof Auth | null = null;
// Pending authenticator waiting for OTP
let pendingAuthenticator: typeof MyInvestorAuthenticator | null = null;

const server = new Server(
  { name: "myinvestor-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ──────────────────────────────────────────────
// Tool definitions
// ──────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Auth ──────────────────────────────────
    {
      name: "login",
      description:
        "Inicia sesión en Myinvestor. Si el dispositivo es nuevo recibirás un SMS y deberás llamar a validate_otp con el código recibido.",
      inputSchema: {
        type: "object",
        properties: {
          user: { type: "string", description: "Usuario de Myinvestor" },
          password: { type: "string", description: "Contraseña" },
          device_id: {
            type: "string",
            description:
              "Identificador único del dispositivo (cualquier cadena estable, p.ej. 'mi-mcp-device')",
          },
        },
        required: ["user", "password", "device_id"],
      },
    },
    {
      name: "validate_otp",
      description:
        "Valida el código OTP recibido por SMS tras un login en dispositivo nuevo. Debe llamarse después de login cuando se solicita OTP.",
      inputSchema: {
        type: "object",
        properties: {
          code: { type: "string", description: "Código OTP de 6 dígitos recibido por SMS" },
        },
        required: ["code"],
      },
    },
    // ── Cuentas corrientes ─────────────────────
    {
      name: "get_checking_accounts",
      description: "Obtiene todas las cuentas corrientes del usuario.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_checking_account_details",
      description: "Obtiene el detalle de una cuenta corriente específica.",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "number", description: "ID de la cuenta corriente" },
        },
        required: ["account_id"],
      },
    },
    // ── Cuentas de ahorro / inversión ──────────
    {
      name: "get_savings_accounts",
      description: "Obtiene todas las cuentas de ahorro e inversión del usuario.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_savings_history",
      description: "Obtiene el historial de rentabilidad de la cartera.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_account_investments",
      description: "Obtiene las inversiones activas de una cuenta de ahorro (fondos en cartera).",
      inputSchema: {
        type: "object",
        properties: {
          savings_account_id: {
            type: "number",
            description: "ID de la cuenta de ahorro/inversión",
          },
        },
        required: ["savings_account_id"],
      },
    },
    // ── Órdenes ───────────────────────────────
    {
      name: "get_orders",
      description: "Obtiene el listado de órdenes de una cuenta de ahorro.",
      inputSchema: {
        type: "object",
        properties: {
          savings_account_id: { type: "number", description: "ID de la cuenta de ahorro" },
          page: { type: "number", description: "Número de página (opcional)" },
        },
        required: ["savings_account_id"],
      },
    },
    {
      name: "get_order_details",
      description: "Obtiene el detalle de una orden específica.",
      inputSchema: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "ID de la orden" },
        },
        required: ["order_id"],
      },
    },
    // ── Productos / Fondos ────────────────────
    {
      name: "search_products",
      description: "Busca fondos de inversión disponibles en Myinvestor.",
      inputSchema: {
        type: "object",
        properties: {
          search_terms: {
            type: "string",
            description: "Términos de búsqueda (nombre del fondo, ISIN, gestora…)",
          },
        },
      },
    },
    {
      name: "get_product_details",
      description: "Obtiene el detalle completo de un fondo (rentabilidades, comisiones, sectores…).",
      inputSchema: {
        type: "object",
        properties: {
          savings_account_id: { type: "number", description: "ID de la cuenta de ahorro" },
          isin: { type: "string", description: "ISIN del fondo" },
        },
        required: ["savings_account_id", "isin"],
      },
    },
    // ── Operaciones de inversión ───────────────
    {
      name: "invest",
      description:
        "Realiza una suscripción a un fondo. Requiere la firma (signature) que se configuró durante el registro. Flujo: busca el producto con search_products, obtén el savings_account_id con get_savings_accounts, luego llama a invest.",
      inputSchema: {
        type: "object",
        properties: {
          savings_account_id: { type: "number", description: "ID de la cuenta de ahorro" },
          isin: { type: "string", description: "ISIN del fondo" },
          amount: { type: "number", description: "Importe en euros a invertir" },
          device_id: { type: "string", description: "Identificador del dispositivo" },
          signature: {
            type: "string",
            description:
              "Firma de seguridad (dígitos de la contraseña de firma separados por comas, p.ej. '1,3,5')",
          },
        },
        required: ["savings_account_id", "isin", "amount", "device_id", "signature"],
      },
    },
    {
      name: "cancel_order",
      description: "Cancela una orden pendiente de ejecución.",
      inputSchema: {
        type: "object",
        properties: {
          savings_account_id: { type: "number", description: "ID de la cuenta de ahorro" },
          order_id: { type: "string", description: "ID de la orden a cancelar" },
          device_id: { type: "string", description: "Identificador del dispositivo" },
          signature: {
            type: "string",
            description: "Firma de seguridad (dígitos separados por comas)",
          },
        },
        required: ["savings_account_id", "order_id", "device_id", "signature"],
      },
    },
  ],
}));

// ──────────────────────────────────────────────
// Tool handlers
// ──────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── login ────────────────────────────────
      case "login": {
        const { user, password, device_id } = args as {
          user: string;
          password: string;
          device_id: string;
        };
        const authenticator = new MyInvestorAuthenticator({ user, password, device_id });
        const result = await authenticator.getToken();

        if (result) {
          // Token obtained directly (device already registered)
          currentAuth = result;
          pendingAuthenticator = null;
          return text("Login exitoso. Sesión iniciada correctamente.");
        } else {
          // OTP required
          pendingAuthenticator = authenticator;
          return text(
            "Se ha enviado un código OTP por SMS. Llama a validate_otp con el código recibido."
          );
        }
      }

      // ── validate_otp ─────────────────────────
      case "validate_otp": {
        if (!pendingAuthenticator) {
          return error("No hay ningún login pendiente de validación OTP. Llama primero a login.");
        }
        const { code } = args as { code: string };
        const auth = await pendingAuthenticator.validateOTP(code);
        currentAuth = auth;
        pendingAuthenticator = null;
        return text("OTP validado. Sesión iniciada correctamente.");
      }

      // ── get_checking_accounts ────────────────
      case "get_checking_accounts": {
        const api = getAPI();
        const accounts = await api.allCheckingAccounts();
        return json(accounts.map(serializeAccount));
      }

      // ── get_checking_account_details ─────────
      case "get_checking_account_details": {
        const api = getAPI();
        const { account_id } = args as { account_id: number };
        const details = await api.checkingAccountDetails(account_id);
        return json(serializeAccount(details));
      }

      // ── get_savings_accounts ─────────────────
      case "get_savings_accounts": {
        const api = getAPI();
        const accounts = await api.allSavingsAccounts();
        return json(
          accounts.map((acc: any) => ({
            ...serializeAccount(acc),
            market_value: acc.market_value,
            invested_amount: acc.invested_amount,
            profit: acc.profit,
            roi: `${(acc.roi * 100).toFixed(2)}%`,
            investments: acc.investments?.map(serializeInvestment) ?? [],
          }))
        );
      }

      // ── get_savings_history ──────────────────
      case "get_savings_history": {
        const api = getAPI();
        const history = await api.savingsHistory();
        return json(history);
      }

      // ── get_account_investments ──────────────
      case "get_account_investments": {
        const api = getAPI();
        const { savings_account_id } = args as { savings_account_id: number };
        const investments = await api.accountInvestment(savings_account_id);
        return json(investments);
      }

      // ── get_orders ───────────────────────────
      case "get_orders": {
        const api = getAPI();
        const { savings_account_id, page } = args as {
          savings_account_id: number;
          page?: number;
        };
        const query = page !== undefined ? { page } : undefined;
        const orders = await api.ordersQuery(savings_account_id, query);
        return json(orders.map(serializeOrder));
      }

      // ── get_order_details ────────────────────
      case "get_order_details": {
        const api = getAPI();
        const { order_id } = args as { order_id: string };
        const order = await api.orderDetails(order_id);
        return json(serializeOrder(order));
      }

      // ── search_products ──────────────────────
      case "search_products": {
        const api = getAPI();
        const { search_terms } = args as { search_terms?: string };
        const products = await api.productsQuery(search_terms);
        return json(
          products.map((p: any) => ({
            isin: p.isin,
            name: p.name,
            type: p.type,
          }))
        );
      }

      // ── get_product_details ──────────────────
      case "get_product_details": {
        const api = getAPI();
        const { savings_account_id, isin } = args as {
          savings_account_id: number;
          isin: string;
        };
        const product = await api.productDetails(savings_account_id, isin);
        return json(serializeProduct(product));
      }

      // ── invest ───────────────────────────────
      case "invest": {
        const api = getAPI();
        const { savings_account_id, isin, amount, device_id, signature } = args as {
          savings_account_id: number;
          isin: string;
          amount: number;
          device_id: string;
          signature: string;
        };
        const result = await api.fullInvest(
          savings_account_id,
          isin,
          amount,
          device_id,
          signature
        );
        return json(result);
      }

      // ── cancel_order ─────────────────────────
      case "cancel_order": {
        const api = getAPI();
        const { savings_account_id, order_id, device_id, signature } = args as {
          savings_account_id: number;
          order_id: string;
          device_id: string;
          signature: string;
        };
        const result = await api.fullCancel(
          savings_account_id,
          order_id,
          device_id,
          signature
        );
        return json(result);
      }

      default:
        return error(`Herramienta desconocida: ${name}`);
    }
  } catch (err: any) {
    return error(`Error: ${err?.message ?? String(err)}`);
  }
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function getAPI() {
  if (!currentAuth) {
    throw new Error("No autenticado. Llama primero a la herramienta login.");
  }
  return new MyInvestorAPI(currentAuth);
}

function text(msg: string) {
  return { content: [{ type: "text" as const, text: msg }] };
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function error(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

function serializeAccount(acc: any) {
  return {
    id: acc.id,
    alias: acc.alias,
    balance: acc.balance,
    iban: acc.iban,
    currency: acc.currency,
    associated_account_id: acc.associated_account_id,
  };
}

function serializeInvestment(inv: any) {
  return {
    isin: inv.isin,
    name: inv.name,
    type: inv.type,
    invested_amount: inv.invested_amount,
    market_value: inv.market_value,
    shares: inv.shares,
    profit: inv.profit,
    roi: `${(inv.roi * 100).toFixed(2)}%`,
    currency: inv.currency_sign,
    category: inv.category,
    last_update: inv.last_update,
  };
}

function serializeOrder(order: any) {
  return {
    order_id: order.order_id,
    order_date: order.order_date,
    isin: order.isin,
    fund_name: order.fund_name,
    order_type: order.order_type,
    cash_amount: order.cash_amount,
    state_code: order.state_code,
    titles: order.titles,
    shares: order.shares,
    currency: order.currency,
    cancellable: order.cancellable,
  };
}

function serializeProduct(p: any) {
  return {
    isin: p.isin,
    name: p.name,
    type: p.type,
    category: p.category,
    market: p.market,
    currency: p.currency_name,
    currency_symbol: p.currency_symbol,
    comission: `${p.comission}%`,
    ter: `${p.ter}%`,
    YTD: `${p.YTD}%`,
    Y1: `${p.Y1}%`,
    Y3: `${p.Y3}%`,
    Y5: `${p.Y5}%`,
    volatility: p.volatility,
    assets: {
      stocks: `${p.assets_stocks}%`,
      liabilities: `${p.assets_liabilities}%`,
      cash: `${p.assets_cash}%`,
      other: `${p.assets_other}%`,
    },
    sectors: p.sectors?.map((s: any) => ({ name: s.name, percentage: `${s.percentage}%` })),
    managing_entity: p.fund_data?.managing_entity,
    socially_responsible: p.socially_responsible,
    dividend_fund: p.dividend_fund,
    latest_price: p.latest_price_data
      ? {
          price: p.latest_price_data.price,
          currency: p.latest_price_data.currency,
          date: p.latest_price_data.date,
        }
      : undefined,
  };
}

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Myinvestor MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
