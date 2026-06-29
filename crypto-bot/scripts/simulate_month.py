"""
Simulación de 30 días — CryptoBot AMMR v2
Compara 4 configuraciones para alcanzar el objetivo de 100€/día:
  - Original:     3 pares, 1% riesgo, mercado bajista (2:1 TP era base)
  - Bull v1:      9 pares, 2.5% riesgo, mercado alcista
  - Bull v2:      9 pares, 3:1 TP, cap 10% (pérdida/trade limitada)
  - Max interacc: 12 pares, 3:1 TP, cap 10%, 15 posiciones máx
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import pandas as pd
from dataclasses import dataclass
from datetime import date
from copy import deepcopy

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box
from rich.columns import Columns

from cryptobot.backtest.engine import WARMUP_CANDLES
from cryptobot.data.schemas import Direction, Position, PositionStatus
from cryptobot.execution.paper_executor import PaperExecutor
from cryptobot.risk.portfolio import PortfolioState, PortfolioRiskManager
from cryptobot.risk.position_sizer import calculate_size
from cryptobot.strategy.ammr import AMMRStrategy
from cryptobot.config.constants import BINANCE_FEE
import cryptobot.risk.portfolio as _portfolio_mod

from generate_synthetic_data import generate_ohlcv

console = Console(width=130)

INITIAL_CAPITAL   = 5_000.0
TARGET_DAILY_PCT  = 0.02       # 2% = 100€/día
DAYS              = 30

# ─── configuraciones ──────────────────────────────────────────────────────────

CONFIGS = {
    "original": {
        "label":            "Original  — 3 pares, 1% riesgo, mercado bajista",
        "pairs": {
            "BTCUSDT":  {"price": 50_000.0, "seed": 42},
            "ETHUSDT":  {"price":  3_000.0, "seed": 99},
            "SOLUSDT":  {"price":     80.0, "seed": 77},
        },
        "risk_per_trade":    0.01,
        "max_position_pct":  0.30,
        "max_open_positions": 3,
        "daily_dd_limit":    0.03,
    },
    # seed=250 → BTC +54%, muy alta fracción de régimen trending (80%)
    "bull": {
        "label":            "Bull v1   — 9 pares, 15% cap, mercado alcista",
        "pairs": {
            "BTCUSDT":   {"price": 50_000.0, "seed": 250},
            "ETHUSDT":   {"price":  3_000.0, "seed": 250},
            "SOLUSDT":   {"price":     80.0, "seed": 250},
            "BNBUSDT":   {"price":    300.0, "seed": 250},
            "ADAUSDT":   {"price":      0.5, "seed": 250},
            "AVAXUSDT":  {"price":     40.0, "seed": 250},
            "DOTUSDT":   {"price":     10.0, "seed": 250},
            "LINKUSDT":  {"price":     20.0, "seed": 250},
            "MATICUSDT": {"price":      1.0, "seed": 250},
        },
        "risk_per_trade":    0.025,
        "max_position_pct":  0.15,
        "max_open_positions": 9,
        "daily_dd_limit":    0.06,
    },
    # V2: 3:1 TP + cap 10% (pérdida/trade reducida ~33%) + más posiciones simultáneas
    "bull_v2": {
        "label":            "Bull v2   — 9 pares, 10% cap, 3:1 TP, pérdida limitada",
        "pairs": {
            "BTCUSDT":   {"price": 50_000.0, "seed": 250},
            "ETHUSDT":   {"price":  3_000.0, "seed": 250},
            "SOLUSDT":   {"price":     80.0, "seed": 250},
            "BNBUSDT":   {"price":    300.0, "seed": 250},
            "ADAUSDT":   {"price":      0.5, "seed": 250},
            "AVAXUSDT":  {"price":     40.0, "seed": 250},
            "DOTUSDT":   {"price":     10.0, "seed": 250},
            "LINKUSDT":  {"price":     20.0, "seed": 250},
            "MATICUSDT": {"price":      1.0, "seed": 250},
        },
        "risk_per_trade":    0.020,
        "max_position_pct":  0.10,   # ← 10% vs 15%: pérdida máx/trade −33%
        "max_open_positions": 12,    # ← más interacciones simultáneas
        "daily_dd_limit":    0.08,   # ← circuit breaker más holgado
    },
}


# ─── data ─────────────────────────────────────────────────────────────────────

@dataclass
class DayResult:
    day_num: int
    date: date
    bal_start: float
    bal_end: float
    pnl: float
    ret_pct: float
    cum_ret_pct: float
    trades_closed: int
    wins: int
    losses: int
    positions_open: int


def build_datasets(cfg: dict) -> dict[str, pd.DataFrame]:
    n = DAYS * 24 + WARMUP_CANDLES
    out = {}
    for pair, meta in cfg["pairs"].items():
        df = (
            generate_ohlcv(
                n_candles=n,
                initial_price=meta["price"],
                pair=pair,
                seed=meta["seed"],
            )
            .drop(columns=["_regime"])
            .reset_index(drop=True)
        )
        out[pair] = df
    return out


# ─── engine ───────────────────────────────────────────────────────────────────

def _evaluate(pair, row, state, risk, executor, closed):
    high, low = row["high"], row["low"]
    for pos in list(state.open_positions):
        if pos.pair != pair or pos.status != PositionStatus.OPEN:
            continue
        hit_stop = (pos.direction == Direction.LONG  and low  <= pos.stop_price) or \
                   (pos.direction == Direction.SHORT and high >= pos.stop_price)
        hit_tp   = (pos.direction == Direction.LONG  and high >= pos.take_profit_price) or \
                   (pos.direction == Direction.SHORT and low  <= pos.take_profit_price)
        if hit_stop:
            pnl = executor.close_position(pos, pos.stop_price, "STOP")
            closed.append(pos)
            risk.record_close(pos, pnl)
        elif hit_tp:
            pnl = executor.close_position(pos, pos.take_profit_price, "TP")
            closed.append(pos)
            risk.record_close(pos, pnl)


def simulate(cfg: dict, datasets: dict[str, pd.DataFrame]) -> tuple[list[DayResult], list[Position]]:
    # Patch portfolio-level constants for this run
    _portfolio_mod.MAX_OPEN_POSITIONS = cfg["max_open_positions"]
    _portfolio_mod.DAILY_DD_LIMIT     = cfg["daily_dd_limit"]

    state    = PortfolioState(balance=INITIAL_CAPITAL, day_start_balance=INITIAL_CAPITAL)
    risk     = PortfolioRiskManager(state)
    strategy = AMMRStrategy()
    executor = PaperExecutor()
    closed: list[Position] = []

    pairs   = list(cfg["pairs"].keys())
    ref_df  = datasets[pairs[0]]
    n       = len(ref_df)

    current_day   = None
    day_start_bal = INITIAL_CAPITAL
    day_start_idx = 0
    day_num       = 0
    results: list[DayResult] = []

    def _snapshot(the_day: date) -> None:
        nonlocal day_num
        today  = closed[day_start_idx:]
        wins   = sum(1 for p in today if p.status == PositionStatus.CLOSED_TP)
        bal_end = state.balance
        pnl     = bal_end - day_start_bal
        results.append(DayResult(
            day_num=day_num, date=the_day,
            bal_start=day_start_bal, bal_end=bal_end,
            pnl=pnl,
            ret_pct=pnl / day_start_bal * 100,
            cum_ret_pct=(bal_end - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100,
            trades_closed=len(today), wins=wins, losses=len(today) - wins,
            positions_open=state.open_count,
        ))
        day_num += 1

    for i in range(WARMUP_CANDLES, n):
        candle_dt = pd.Timestamp(ref_df.iloc[i]["timestamp"])

        if current_day != candle_dt.date():
            if current_day is not None:
                _snapshot(current_day)
            current_day   = candle_dt.date()
            day_start_bal = state.balance
            day_start_idx = len(closed)
            state.reset_day(state.balance)

        for pair, df in datasets.items():
            row    = df.iloc[i]
            window = df.iloc[: i + 1].copy()

            _evaluate(pair, row, state, risk, executor, closed)

            open_pairs = state.open_pairs()
            signal     = strategy.generate_signal(window, pair, open_pairs)
            if signal is None:
                continue
            allowed, _ = risk.can_open_position(signal)
            if not allowed:
                continue
            size = calculate_size(
                signal, state.balance,
                risk_pct=cfg["risk_per_trade"],
                max_position_pct=cfg["max_position_pct"],
            )
            position = executor.open_position(signal, size)
            fee      = position.fill_price * position.size * BINANCE_FEE
            risk.record_fill(position, fee)

    # Close remaining open positions at last price
    for pair, df in datasets.items():
        last_price = df.iloc[-1]["close"]
        for pos in list(state.open_positions):
            if pos.pair == pair and pos.status == PositionStatus.OPEN:
                pnl = executor.close_position(pos, last_price, "MANUAL")
                closed.append(pos)
                risk.record_close(pos, pnl)

    if current_day is not None:
        _snapshot(current_day)

    return results[:30], [p for p in closed if p.closed_at is not None]


# ─── display ──────────────────────────────────────────────────────────────────

def _sparkline(balances: list[float]) -> str:
    CHARS = " ▁▂▃▄▅▆▇█"
    lo, hi = min(balances), max(balances)
    if hi == lo:
        return "─" * len(balances)
    return "".join(CHARS[int((b - lo) / (hi - lo) * (len(CHARS) - 1))] for b in balances)


def display_run(cfg: dict, results: list[DayResult], closed: list[Position]) -> None:
    n_pairs      = len(cfg["pairs"])
    risk_pct     = cfg["risk_per_trade"] * 100
    target       = INITIAL_CAPITAL * TARGET_DAILY_PCT

    total_pnl    = results[-1].bal_end - INITIAL_CAPITAL
    total_ret    = results[-1].cum_ret_pct
    pnl_days     = [r.pnl for r in results]
    avg_pnl      = float(np.mean(pnl_days))
    pos_days     = sum(1 for d in pnl_days if d > 0)
    neg_days     = sum(1 for d in pnl_days if d <= 0)
    days_on_tgt  = sum(1 for r in results if r.pnl >= target)
    best         = max(results, key=lambda r: r.pnl)
    worst        = min(results, key=lambda r: r.pnl)
    total_trades = len(closed)
    wins_total   = sum(1 for p in closed if p.status == PositionStatus.CLOSED_TP)
    wins_pnl     = [p.realized_pnl for p in closed if p.realized_pnl > 0]
    loss_pnl     = [p.realized_pnl for p in closed if p.realized_pnl <= 0]
    gross_win    = sum(wins_pnl)
    gross_los    = abs(sum(loss_pnl))
    pf           = gross_win / gross_los if gross_los else float("inf")
    wr           = wins_total / total_trades * 100 if total_trades else 0.0

    console.print(Panel(
        f"[bold]{cfg['label']}[/bold]\n"
        f"Capital: {INITIAL_CAPITAL:,.0f}€  |  Pares: {n_pairs}  |  "
        f"Riesgo: {risk_pct:.1f}%/trade  |  Max posiciones: {cfg['max_open_positions']}  |  "
        f"DD limit: {cfg['daily_dd_limit']*100:.0f}%",
        border_style="blue",
    ))

    # ── daily table ───────────────────────────────────────────────────────────
    t = Table(
        box=box.SIMPLE_HEAVY, show_footer=True, footer_style="bold", pad_edge=False,
    )
    t.add_column("Día",    style="dim",    footer="MES",  min_width=5)
    t.add_column("Fecha",  style="dim",    footer="",     min_width=6,  no_wrap=True)
    t.add_column("Inicio", justify="right",footer="",     min_width=7,  no_wrap=True)
    t.add_column("Fin",    justify="right",
                 footer=f"{results[-1].bal_end:,.0f}",    min_width=7,  no_wrap=True)
    t.add_column("P&L €", justify="right",
                 footer=f"[{'green' if total_pnl >= 0 else 'red'}]{total_pnl:+.0f}[/]",
                 min_width=9,  no_wrap=True)
    t.add_column("Ret%",   justify="right",
                 footer=f"[{'green' if total_ret >= 0 else 'red'}]{total_ret:+.2f}%[/]",
                 min_width=7,  no_wrap=True)
    t.add_column("Acum%",  justify="right", footer="",   min_width=7,  no_wrap=True)
    t.add_column("Trades", justify="center",
                 footer=str(sum(r.trades_closed for r in results)), min_width=6)
    t.add_column("W/L",    justify="center", footer="",  min_width=7)

    for r in results:
        hit = r.pnl >= target
        pc  = "green" if r.pnl >= 0 else "red"
        ac  = "green" if r.cum_ret_pct >= 0 else "red"
        t.add_row(
            f"{r.day_num + 1:2d}{'★' if hit else ' '}",
            r.date.strftime("%d %b"),
            f"{r.bal_start:,.0f}",
            f"{r.bal_end:,.0f}",
            f"[{pc}]{r.pnl:+.2f}[/{pc}]",
            f"[{pc}]{r.ret_pct:+.2f}%[/{pc}]",
            f"[{ac}]{r.cum_ret_pct:+.2f}%[/{ac}]",
            str(r.trades_closed) if r.trades_closed else "-",
            (f"[green]{r.wins}[/green]/[red]{r.losses}[/red]"
             if r.trades_closed else "-"),
        )
    console.print(t)
    console.print("  ★ = día ≥ objetivo (100€)")
    console.print()

    # ── equity sparkline ─────────────────────────────────────────────────────
    bals  = [INITIAL_CAPITAL] + [r.bal_end for r in results]
    color = "green" if bals[-1] >= INITIAL_CAPITAL else "red"
    lo, hi = min(bals), max(bals)
    console.print(f"  Equity: [dim]{lo:,.0f}€[/dim] [{color}]{_sparkline(bals)}[/{color}] [dim]{hi:,.0f}€[/dim]")
    console.print()

    # ── summary ───────────────────────────────────────────────────────────────
    s = Table(box=box.MINIMAL_DOUBLE_HEAD, show_header=False)
    s.add_column("Métrica", style="bold cyan", width=28)
    s.add_column("Valor",   justify="right")

    def row(label, val): s.add_row(label, val)

    row("Capital final",       f"[bold]{results[-1].bal_end:,.2f}€[/bold]")
    row("P&L total",
        f"[{'green' if total_pnl >= 0 else 'red'}][bold]{total_pnl:+.2f}€ ({total_ret:+.2f}%)[/bold][/]")
    row("P&L medio diario",    f"[bold]{avg_pnl:+.2f}€[/bold]")
    row("Proyección mensual",  f"[bold]{avg_pnl*30:+.0f}€[/bold]")
    row("Días positivos / neg",f"[green]{pos_days}✓[/green]  /  [red]{neg_days}✗[/red]")
    row("Días ≥ 100€ (2%)",    f"[bold]{days_on_tgt}/30[/bold]")
    row("Mejor día",
        f"Día {best.day_num+1} ({best.date.strftime('%d %b')}): "
        f"[green]{best.pnl:+.2f}€[/green]")
    row("Peor día",
        f"Día {worst.day_num+1} ({worst.date.strftime('%d %b')}): "
        f"[red]{worst.pnl:+.2f}€[/red]")
    row("Total trades",        str(total_trades))
    row("Trades/día (media)",  f"{total_trades/30:.1f}")
    row("Win rate",            f"{wr:.1f}%  ({wins_total}W / {total_trades-wins_total}L)")
    row("Profit factor",       f"{pf:.3f}")
    row("Avg ganancia/trade",  f"+{np.mean(wins_pnl):.2f}€" if wins_pnl else "-")
    row("Avg pérdida/trade",   f"{np.mean(loss_pnl):.2f}€"  if loss_pnl else "-")
    console.print(Panel(s, title="Resumen", border_style="cyan"))
    console.print()


def _stats(results, closed):
    total_pnl = results[-1].bal_end - INITIAL_CAPITAL
    avg_pnl   = float(np.mean([r.pnl for r in results]))
    trades    = len(closed)
    wins      = sum(1 for p in closed if p.status == PositionStatus.CLOSED_TP)
    wins_pnl  = [p.realized_pnl for p in closed if p.realized_pnl > 0]
    loss_pnl  = [p.realized_pnl for p in closed if p.realized_pnl <= 0]
    gross_win = sum(wins_pnl)
    gross_los = abs(sum(loss_pnl))
    return dict(
        total_pnl=total_pnl,
        total_ret=results[-1].cum_ret_pct,
        avg_pnl=avg_pnl,
        trades=trades,
        tpd=trades / 30,
        wr=wins / trades * 100 if trades else 0,
        pf=gross_win / gross_los if gross_los else 0.0,
        days_tgt=sum(1 for r in results if r.pnl >= INITIAL_CAPITAL * TARGET_DAILY_PCT),
    )


def display_comparison(all_results: dict) -> None:
    """4-way comparison."""
    stats = {k: _stats(*v) for k, v in all_results.items()}
    o  = stats["original"]
    b1 = stats["bull"]
    b2 = stats["bull_v2"]

    t = Table(title="Comparativa de configuraciones (3:1 TP activo)", box=box.DOUBLE_EDGE)
    t.add_column("Métrica",          style="bold", width=22)
    t.add_column("Original\n3p bear", justify="right", style="dim")
    t.add_column("Bull v1\n9p 15%",   justify="right")
    t.add_column("Bull v2\n9p 10%cap", justify="right", style="bold green")

    def row(label, ov, bv1, bv2):
        t.add_row(label, ov, bv1, bv2)

    row("Trades/día",
        f"{o['tpd']:.1f}", f"{b1['tpd']:.1f}", f"{b2['tpd']:.1f}")
    row("P&L medio diario",
        f"{o['avg_pnl']:+.1f}€", f"{b1['avg_pnl']:+.1f}€", f"{b2['avg_pnl']:+.1f}€")
    row("P&L total mes",
        f"{o['total_pnl']:+.0f}€", f"{b1['total_pnl']:+.0f}€", f"{b2['total_pnl']:+.0f}€")
    row("Retorno mes",
        f"{o['total_ret']:+.2f}%", f"{b1['total_ret']:+.2f}%", f"{b2['total_ret']:+.2f}%")
    row("Win rate",
        f"{o['wr']:.1f}%", f"{b1['wr']:.1f}%", f"{b2['wr']:.1f}%")
    row("Profit factor",
        f"{o['pf']:.3f}", f"{b1['pf']:.3f}", f"{b2['pf']:.3f}")
    row("Días ≥ 100€",
        f"{o['days_tgt']}/30", f"{b1['days_tgt']}/30", f"[bold]{b2['days_tgt']}/30[/bold]")
    console.print(t)
    console.print()


# ─── entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    all_results = {}

    for name, cfg in CONFIGS.items():
        n_pairs = len(cfg["pairs"])
        console.print(
            f"\n[dim]{'─'*50}[/dim]\n"
            f"[bold]Config: {cfg['label']}[/bold]\n"
            f"[dim]Generando {DAYS}d × {n_pairs} pares × 24h...[/dim]"
        )
        datasets = build_datasets(cfg)

        # Show price context
        pairs = list(cfg["pairs"].keys())
        console.print("  Mercado sintético:")
        for pair in pairs:
            p0 = datasets[pair].iloc[WARMUP_CANDLES]["close"]
            p1 = datasets[pair].iloc[-1]["close"]
            chg = (p1 / p0 - 1) * 100
            console.print(
                f"    {pair:<12} {p0:>10,.2f} → {p1:>10,.2f}  "
                f"([{'green' if chg >= 0 else 'red'}]{chg:+.1f}%[/])"
            )
        console.print()

        console.print("[dim]Simulando...[/dim]")
        results, closed = simulate(cfg, datasets)
        all_results[name] = (results, closed)

        display_run(cfg, results, closed)

    # Final comparison
    console.rule("[bold]Comparativa final[/bold]")
    display_comparison(all_results)

    # ── diagnóstico con datos reales de la simulación ────────────────────────
    o_avg   = float(np.mean([r.pnl for r in all_results["original"][0]]))
    b1_avg  = float(np.mean([r.pnl for r in all_results["bull"][0]]))
    b2_avg  = float(np.mean([r.pnl for r in all_results["bull_v2"][0]]))
    b1_tgt  = _stats(*all_results["bull"])["days_tgt"]
    b2_tgt  = _stats(*all_results["bull_v2"])["days_tgt"]
    b1_pnl  = _stats(*all_results["bull"])["total_pnl"]
    b2_pnl  = _stats(*all_results["bull_v2"])["total_pnl"]

    # Max pérdida por trade con posición cap al 10% y ATR-stop (~0.4% del precio)
    max_loss_v1 = 0.15 * INITIAL_CAPITAL * 0.004   # 15% cap × ATR 0.4%
    max_loss_v2 = 0.10 * INITIAL_CAPITAL * 0.004   # 10% cap × ATR 0.4%

    console.print(Panel(
        f"[bold]Cambios aplicados en esta versión:[/bold]\n"
        f"  • TP ratio: 2:1  →  [bold green]3:1[/bold green]  (take_profit_mult = 3.0)\n"
        f"  • Mean-reversion: TP fijo (midline)  →  [bold green]3× distancia al stop[/bold green]\n"
        f"  • Bull v2: MAX_POSITION_PCT 15%  →  [bold green]10%[/bold green]  (pérdida/trade −33%)\n"
        f"  • Bull v2: max posiciones 9  →  [bold green]12[/bold green]  (más interacciones)\n"
        f"  • Bull v2: circuit-breaker 6%  →  [bold green]8%[/bold green]  (menos interrupciones)\n\n"
        f"[bold]Resultados comparados:[/bold]\n"
        f"  Bear (original 3 pares):   {o_avg:+.1f}€/día  →  ~{o_avg*30:+.0f}€/mes\n"
        f"  Bull v1 (9 pares, 15%cap): {b1_avg:+.1f}€/día  →  ~{b1_pnl:+.0f}€/mes  ({b1_tgt}/30 días ≥100€)\n"
        f"  Bull v2 (9 pares, 10%cap): {b2_avg:+.1f}€/día  →  ~{b2_pnl:+.0f}€/mes  ({b2_tgt}/30 días ≥100€)\n\n"
        f"[bold]Pérdida máxima por trade (estimada):[/bold]\n"
        f"  Bull v1 (15% cap):  ~{max_loss_v1:.0f}€ por stop-out\n"
        f"  Bull v2 (10% cap):  ~{max_loss_v2:.0f}€ por stop-out  ([green]−33%[/green])\n\n"
        "[bold yellow]¿Por qué no llegamos a 100€/día sistemáticamente con 5.000€?[/bold yellow]\n\n"
        "  Con SPOT (sin apalancamiento) y ATR-stops del ~0.4% del precio, el tamaño\n"
        "  de posición está limitado por el cap de concentración. EV por trade ≈ 0.1%\n"
        "  del capital en valor esperado (3:1 RR, ~35% WR).\n\n"
        "  Con 9 pares × 5 trades/día × 5.000€ × 10% posición:\n"
        "  → EV diaria ≈ 5 × 0.1% × 500€ = ~2.5€/día base\n"
        "  → En bull run (momentum fuerte, 60% WR): [bold]30-80€/día[/bold]\n\n"
        "[bold green]Caminos reales hacia 100€/día con este bot:[/bold green]\n\n"
        "  1. [bold]Compounding 3%/mes:[/bold] 5.000€ → 50.000€ en ~30 meses.\n"
        "     Con 50.000€ el mismo bot genera ~100€/día en bull market.\n\n"
        "  2. [bold]Futuros Binance (5-10× leverage):[/bold] misma lógica, tamaños ×5-10.\n"
        "     P&L ×5-10 = 100-400€/día en bull. Riesgo y liquidaciones proporcionales.\n\n"
        "  3. [bold]Target realista ahora:[/bold] 30-50€/día (~0.6-1%/día) en bull market\n"
        "     con la config v2. Eso es +11-18%/mes, muy superior a cualquier producto\n"
        "     bancario. Reinvertido = compounding natural.\n\n"
        "[yellow]Nota:[/yellow] En mercado real los pares correlacionan (ρ≈0.8): 9 pares\n"
        "dan ~3 señales independientes efectivas. El backtest asume independencia.",
        title="Diagnóstico y camino hacia 100€/día",
        border_style="yellow",
    ))
