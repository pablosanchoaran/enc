# CryptoBot SPEC v1.0

Sistema de trading automatizado en criptomonedas sobre Binance SPOT.  
Objetivo: 100€/día sobre 5.000€ de capital con reinversión diaria de beneficios.

---

## 1. Project Overview

**Propósito:** Bot de trading algorítmico personal para operar BTC, ETH y SOL en Binance usando la estrategia AMMR (Adaptive Momentum + Mean Reversion). No es un producto comercial.

**Alcance v1:**
- Mercado: Crypto SPOT (sin margen, sin futuros)
- Pares: BTCUSDT, ETHUSDT, SOLUSDT
- Timeframe primario: 1H
- Modos: Backtest → Paper → Live (escalado progresivo)

**No-goals (fuera de scope v1):**
- Apalancamiento o futuros
- Altcoins más allá de los 3 pares definidos
- Múltiples exchanges
- Estrategias ML/AI
- Portfolio rebalancing automático

---

## 2. Risk Disclosures

> **Estas divulgaciones deben leerse antes de operar con capital real.**

**RD-01 — Capital a riesgo total**
Este sistema opera con criptoactivos reales. La pérdida total del capital desplegado es posible. No operar con capital que no se pueda perder en su totalidad.

**RD-02 — Expectativa de rendimiento**
El objetivo de 100€/día sobre 5.000€ (2%/día) es un objetivo aspiracional. El análisis histórico de la estrategia AMMR sobre datos 2020-2024 sugiere una baseline realista de 30-70€/día en condiciones favorables, con frecuentes días negativos. Un 2%/día compuesto equivale a +1.200% anual en teoría — sistemáticamente inalcanzable. El sistema gestiona riesgo, no garantiza rentabilidad.

**RD-03 — Modos de fallo de la estrategia**
AMMR rinde mal en: (a) mercados laterales con baja volatilidad prolongada (ADX < 15 durante semanas); (b) flash crashes donde el precio supera el stop con slippage extremo; (c) cambios de régimen donde ADX tarda 2-5 velas en reaccionar, generando pérdidas iniciales.

**RD-04 — Sesgo de backtest**
Los resultados de backtest no predicen rendimiento futuro. Los parámetros optimizados en datos históricos pueden no generalizar. Es obligatorio el walk-forward sobre datos out-of-sample (mínimo 6 meses no usados en optimización) antes de confiar en métricas de backtest.

**RD-05 — Riesgo de exchange y API**
Outages de Binance, rate limits o suspensión de cuenta pueden impedir la ejecución de órdenes. La lógica de reconexión está incluida pero no garantiza ejecución durante caídas del exchange. Las posiciones abiertas quedan protegidas solo por las stop-loss orders en el exchange durante outages.

**RD-06 — Obligaciones fiscales**
El trading automatizado puede generar eventos fiscales en tu jurisdicción. El operador es exclusivamente responsable de la declaración fiscal. El sistema registra todas las operaciones para facilitar la contabilidad pero no proporciona asesoramiento fiscal.

**RD-07 — Bugs de software**
Este es software custom. Errores en el position sizer, stop-loss o routing de órdenes pueden causar pérdidas más allá de los parámetros de riesgo previstos. La fase de paper trading existe precisamente para detectar estos bugs antes de arriesgar capital real.

**RD-08 — Régimen regulatorio**
El trading automatizado puede estar sujeto a regulación en tu jurisdicción. Verificar cumplimiento antes de operar con capital real.

---

## 3. Glossary

| Término | Definición |
|---|---|
| ADX | Average Directional Index — mide la fuerza de tendencia (no dirección) |
| ATR | Average True Range — mide volatilidad de precio en un período |
| AMMR | Adaptive Momentum + Mean Reversion — estrategia híbrida de este sistema |
| Regime | Estado del mercado: TRENDING, RANGING o TRANSITION |
| Signal | Instrucción de entrada/salida generada por la estrategia |
| Paper mode | Simulación de trading sin órdenes reales al exchange |
| Slippage | Diferencia entre precio esperado y precio real de ejecución |
| Circuit breaker | Mecanismo que detiene el trading al superar una pérdida diaria umbral |
| Compounding | Reinversión de beneficios — el capital base crece diariamente |
| Gate | Criterio de aceptación que debe cumplirse para avanzar de fase |

---

## 4. System Requirements

### 4.1 Functional Requirements

| ID | Requisito |
|---|---|
| FR-01 | El sistema descarga y almacena datos OHLCV históricos por par y timeframe |
| FR-02 | El sistema suscribe a streams WebSocket de velas en tiempo real |
| FR-03 | El sistema detecta huecos de datos y los marca/interpola |
| FR-04 | El sistema calcula EMA, ADX, RSI, Bollinger Bands y ATR sobre DataFrames OHLCV |
| FR-05 | El sistema clasifica el régimen de mercado como TRENDING / RANGING / TRANSITION |
| FR-06 | El sistema genera señales de entrada con precio, stop-loss y take-profit |
| FR-07 | El sistema calcula el tamaño de posición basado en 1% del capital actual y la distancia al stop |
| FR-08 | El sistema aplica circuit breaker si el drawdown diario supera el 3% |
| FR-09 | El sistema simula ejecución (paper) con slippage realista del 0.05% |
| FR-10 | El sistema coloca órdenes reales en Binance SPOT con OCO stop en modo live |
| FR-11 | El sistema ejecuta backtests event-driven y produce métricas de performance |
| FR-12 | El sistema envía alertas y resumen diario por Telegram |
| FR-13 | El sistema expone CLI con comandos: backtest, paper, live, report, go-live |
| FR-14 | El sistema recalcula el tamaño de posición cada día basado en balance actualizado (compounding) |
| FR-15 | El comando go-live verifica 4 gate criteria antes de permitir modo live |

### 4.2 Non-Functional Requirements

| ID | Requisito |
|---|---|
| NFR-01 | Latencia < 200ms desde cierre de vela hasta colocación de orden |
| NFR-02 | Cero excepciones no manejadas en modo live (recovery automático con log) |
| NFR-03 | Toda configuración sensible via variables de entorno (sin secrets en código) |
| NFR-04 | Cobertura de tests ≥ 95% en módulos strategy y risk antes de modo live |
| NFR-05 | Log de auditoría de cada decisión (no solo de trades ejecutados) |
| NFR-06 | El código de estrategia (ammr.py) es agnóstico al modo de ejecución |

---

## 5. Strategy Specification — AMMR

### 5.1 Parámetros

| Parámetro | Valor por defecto | Rango válido |
|---|---|---|
| ADX period | 14 | 10-20 |
| ADX trending threshold | 25 | 20-30 |
| ADX ranging threshold | 20 | 15-25 |
| EMA fast period | 8 | 5-12 |
| EMA slow period | 21 | 18-26 |
| RSI period | 14 | 10-21 |
| RSI overbought | 65 | 60-75 |
| RSI oversold | 35 | 25-40 |
| Bollinger period | 20 | 15-25 |
| Bollinger std dev | 2.0 | 1.5-2.5 |
| Breakout lookback | 20 | 15-30 |
| Take-profit multiplier | 2.0 | 1.5-3.0 |
| ATR period | 14 | 10-20 |

### 5.2 Reglas de entrada

| Condición | Régimen | Dirección | Señal |
|---|---|---|---|
| Close > 20-period high AND EMA8 > EMA21 AND RSI 45-70 | TRENDING | LONG | Entrada a mercado |
| Close < 20-period low AND EMA8 < EMA21 AND RSI 30-55 | TRENDING | SHORT | Entrada a mercado |
| Close ≤ BB lower AND RSI < 35 | RANGING | LONG | Entrada a mercado |
| Close ≥ BB upper AND RSI > 65 | RANGING | SHORT | Entrada a mercado |
| Cualquier condición | TRANSITION | — | Sin nueva señal |
| Ya existe posición abierta en el par | Cualquiera | — | Sin nueva señal |

### 5.3 Reglas de salida

**Stop-loss inicial:**
- TRENDING LONG: EMA-21 − 1×ATR
- TRENDING SHORT: EMA-21 + 1×ATR
- RANGING LONG: BB lower − 0.5×band_width
- RANGING SHORT: BB upper + 0.5×band_width

**Take-profit:**
- TRENDING: entrada + 2× (distancia al stop)
- RANGING LONG: BB midline
- RANGING SHORT: BB midline

**Trailing stop (TRENDING únicamente):**
- Cuando el precio supera entrada + 1×ATR: stop se mueve a breakeven (entrada)
- El stop sigue subiendo con EMA-21, nunca baja

### 5.4 Gestión de posiciones abiertas
- Máximo 3 posiciones simultáneas en el portfolio
- Máximo 1 posición por par en cualquier dirección

---

## 6. Risk Management Specification

### 6.1 Position Sizing
```
risk_amount = portfolio_balance * 0.01          # 1% del balance ACTUAL
stop_distance = abs(entry_price - stop_price)
position_size = risk_amount / stop_distance     # en unidades del activo
max_position_value = portfolio_balance * 0.30   # cap: 30% del portfolio
position_size = min(position_size, max_position_value / entry_price)
```
El `portfolio_balance` se actualiza al inicio de cada día UTC (compounding).

### 6.2 Portfolio-level limits
- Máximo 3 posiciones abiertas simultáneamente
- Si correlación 30d entre dos pares > 0.85 y ambos son LONG/SHORT en la misma dirección: reducir tamaño del segundo en 50%
- Capital mínimo operativo: si el balance cae < 2.000€ → pausar trading y notificar

### 6.3 Circuit Breaker (Drawdown Diario)
- Umbral: 3% de pérdida sobre el balance al inicio del día UTC
- Al activarse: suspender toda nueva señal hasta las 00:00 UTC del día siguiente
- Las stop-loss orders existentes permanecen activas en el exchange
- Notificación inmediata por Telegram

### 6.4 Trailing Stop Engine
- Evalúa cada vela cerrada
- Solo mueve el stop en dirección favorable (nunca en contra)
- Loguea cada movimiento del stop con precio anterior y nuevo

---

## 7. Execution Modes

### 7.1 Backtest Mode
- Usa datos históricos OHLCV almacenados localmente
- Engine event-driven: procesa vela a vela en orden cronológico
- Simula fills al precio de apertura de la vela siguiente (no look-ahead bias)
- Slippage fijo del 0.05% + comisión Binance del 0.1% por trade
- Output: JSON + HTML con todas las métricas de performance

### 7.2 Paper Trading Mode
- Datos en tiempo real via WebSocket (read-only API keys)
- PaperExecutor: simula fills sin enviar órdenes al exchange
- Slippage simulado: precio de señal + 0.05% para compras, − 0.05% para ventas
- Estado del portfolio persistido en SQLite
- Idéntico al backtest engine en términos de lógica de decisión

### 7.3 Live Trading Mode
- Requiere API keys con permisos SPOT trading
- LiveExecutor: MARKET order para entrada + OCO order para stop/take-profit
- Order IDs almacenados en registro de posición
- Polling de estado de orden cada 30 segundos
- Retry automático (max 3) en errores transitorios de API

### 7.4 Transición Paper → Live (Go-Live Gate)

Todos los criterios deben cumplirse para habilitar el modo live:

| Gate | Criterio mínimo |
|---|---|
| G-01 Duración | ≥ 30 días calendario en paper mode |
| G-02 Volumen | ≥ 60 trades ejecutados en paper |
| G-03 Sharpe | Sharpe ratio (30d paper) ≥ 1.0 |
| G-04 Drawdown | Max drawdown (30d paper) < 8% |

El comando `cryptobot go-live --confirm` imprime tabla PASS/FAIL y pide confirmación explícita.

### 7.5 Capital Ladder (Live)

| Semana | Capital desplegado | Condición para avanzar |
|---|---|---|
| 1-2 | 1.000€ | — |
| 3-4 | 2.500€ | DD semanas 1-2 < 3% |
| Mes 2 | 5.000€ | Sharpe mes 1 ≥ 0.8 |

---

## 8. Data Specification

### 8.1 Fuentes de datos
- Histórico: Binance REST API (`/api/v3/klines`)
- Tiempo real: Binance WebSocket (`<pair>@kline_<interval>`)

### 8.2 OHLCV Schema

| Campo | Tipo | Descripción |
|---|---|---|
| timestamp | datetime (UTC) | Apertura de la vela |
| open | float | Precio de apertura |
| high | float | Máximo de la vela |
| low | float | Mínimo de la vela |
| close | float | Precio de cierre |
| volume | float | Volumen en moneda base |
| pair | str | Ej: "BTCUSDT" |
| timeframe | str | Ej: "1h" |
| interpolated | bool | True si el dato fue interpolado por gap |

### 8.3 Data Quality Checks
- No timestamps duplicados por par+timeframe
- `low <= open, close <= high` en cada vela
- Sin valores nulos en OHLCV
- Gaps detectados y marcados con `interpolated=True`

---

## 9. Monitoring & Observability

### 9.1 Métricas a trackear
- Balance actual vs balance inicial del día
- Drawdown diario y desde máximo histórico
- Posiciones abiertas: par, dirección, P&L no realizado
- Número de señales generadas vs ejecutadas vs rechazadas
- Latencia señal → orden (ms)
- Errores de API por tipo

### 9.2 Alert Thresholds (Telegram)

| Evento | Nivel | Mensaje |
|---|---|---|
| Trade ejecutado | INFO | Par, dirección, precio, tamaño |
| Trade cerrado | INFO | Par, P&L realizado, motivo (stop/TP/manual) |
| Circuit breaker | CRITICAL | Balance % caída, hora UTC |
| Reconexión WebSocket | WARNING | Par, duración de outage |
| Balance < 2.000€ | CRITICAL | Trading pausado automáticamente |
| Resumen diario 00:00 UTC | INFO | Trades, P&L, DD, posiciones abiertas |

### 9.3 Log Schema (JSON estructurado)
```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARNING|ERROR|CRITICAL",
  "event": "signal_generated|order_placed|position_closed|...",
  "pair": "BTCUSDT",
  "data": {}
}
```

---

## 10. User Stories

| ID | Historia | Criterios de aceptación |
|---|---|---|
| US-01 | Como operador quiero descargar 365 días de datos históricos en un comando | El comando completa sin errores; la BD contiene 8.760 velas para BTCUSDT 1H; no hay gaps |
| US-02 | Como operador quiero que el bot detecte gaps de datos | El checker reporta velas faltantes; las interpola y las marca |
| US-03 | Como estrategia quiero clasificar el régimen de mercado | ADX > 25 → TRENDING; ADX < 20 → RANGING; entre ambos → TRANSITION |
| US-04 | Como estrategia quiero generar señales solo en régimen definido | En TRANSITION no se genera ninguna señal |
| US-05 | Como estrategia quiero que cada señal incluya stop y take-profit | Toda señal tiene entry_price, stop_price, take_profit_price |
| US-06 | Como risk manager quiero limitar el riesgo por trade al 1% | El sizer nunca genera una posición que pierda más de 1% del balance si alcanza el stop |
| US-07 | Como risk manager quiero detener el trading al 3% de DD diario | Circuit breaker se activa; no se abren nuevas posiciones; Telegram alerta |
| US-08 | Como operador quiero paper trading realista | El paper executor simula slippage; el P&L diverge < 0.5% del backtest en datos idénticos |
| US-09 | Como operador quiero ver el rendimiento del backtest | El reporte incluye Sharpe, Sortino, DD máx, win rate, profit factor |
| US-10 | Como operador quiero recibir alertas por Telegram | Cada trade y el resumen diario llegan al chat configurado |
| US-11 | Como operador quiero que el compounding sea automático | El sizer recalcula daily usando el balance real; el tamaño de posición crece con los beneficios |
| US-12 | Como operador quiero saber cuándo puedo pasar a live | go-live imprime los 4 gate criteria con PASS/FAIL |
| US-13 | Como operador quiero que el live executor use OCO orders | El stop y take-profit se colocan como OCO; si uno ejecuta el otro se cancela |
| US-14 | Como operador quiero trailing stop en tendencia | El stop sube con EMA-21; nunca baja; se loguea cada movimiento |
| US-15 | Como operador quiero que el código de estrategia no sepa el modo | ammr.py no importa ni referencia paper_executor ni live_executor |

---

## 11. Feature File Mapping

| Feature file | User Stories cubiertas |
|---|---|
| `data_collection.feature` | US-01, US-02 |
| `strategy_signals.feature` | US-03, US-04, US-05 |
| `risk_management.feature` | US-06, US-07, US-11, US-14 |
| `execution_modes.feature` | US-08, US-12, US-13 |
| `performance_reporting.feature` | US-09, US-10 |

---

## 12. Out of Scope (v1)

- Futuros, perpetuals, margen o apalancamiento de cualquier tipo
- Más de 3 pares de trading
- Múltiples exchanges o arbitraje
- Estrategias basadas en ML/AI
- Portfolio rebalancing automático entre pares
| - Gestión multi-usuario o multi-cuenta

---

## Appendix A: Backtest Results Template

```json
{
  "run_id": "bt_20240101_BTCUSDT_1H",
  "pair": "BTCUSDT",
  "timeframe": "1h",
  "from": "2023-01-01",
  "to": "2024-01-01",
  "initial_capital": 10000.0,
  "final_capital": 0.0,
  "total_return_pct": 0.0,
  "annualized_return_pct": 0.0,
  "sharpe_ratio": 0.0,
  "sortino_ratio": 0.0,
  "calmar_ratio": 0.0,
  "max_drawdown_pct": 0.0,
  "max_drawdown_duration_days": 0,
  "win_rate": 0.0,
  "profit_factor": 0.0,
  "avg_winner_pct": 0.0,
  "avg_loser_pct": 0.0,
  "total_trades": 0,
  "trades_per_day": 0.0,
  "parameters": {}
}
```

## Appendix B: Parameter Optimization Log Template

| Date | Parameter | Old Value | New Value | Justification | Backtest Sharpe Before | After |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

> Congelar parámetros después de Phase 3. Solo bug fixes después de ese punto.
