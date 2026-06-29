"""
Simulación de 30 días — CryptoBot AMMR
Corre los 3 pares simultáneamente con estado de portfolio compartido,
captura una instantánea de balance al cierre de cada día UTC y muestra
la rentabilidad diaria y acumulada con compounding.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import numpy as np
import pandas as pd
from dataclasses import dataclass
from datetime import date

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box

from cryptobot.backtest.engine import WARMUP_CANDLES
from cryptobot.data.schemas import Direction, Position, PositionStatus
from cryptobot.execution.paper_executor import PaperExecutor
from cryptobot.risk.portfolio import PortfolioState, PortfolioRiskManager
from cryptobot.risk.position_sizer import calculate_size
from cryptobot.strategy.ammr import AMMRStrategy
from cryptobot.config.constants import BINANCE_FEE
sys.path.insert(0, str(Path(__file__).parent))
from generate_synthetic_data import generate_ohlcv

console = Console(width=120)

INITIAL_CAPITAL = 5_000.0
PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
INITIAL_PRICES = {"BTCUSDT": 50_000.0, "ETHUSDT": 3_000.0, "SOLUSDT": 80.0}
SEEDS = {"BTCUSDT": 42, "ETHUSDT": 99, "SOLUSDT": 77}
DAYS = 30
TARGET_DAILY_PCT = 0.02  # 2%


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


# ─── data ─────────────────────────────────────────────────────────────────────

def build_datasets() -> dict[str, pd.DataFrame]:
    n = DAYS * 24 + WARMUP_CANDLES
    out = {}
    for pair in PAIRS:
        df = (
            generate_ohlcv(
                n_candles=n,
                initial_price=INITIAL_PRICES[pair],
                pair=pair,
                seed=SEEDS[pair],
            )
            .drop(columns=["_regime"])
            .reset_index(drop=True)
        )
        out[pair] = df
    return out


# ─── engine ───────────────────────────────────────────────────────────────────

def _evaluate(
    pair: str,
    row: pd.Series,
    state: PortfolioState,
    risk: PortfolioRiskManager,
    executor: PaperExecutor,
    closed: list[Position],
) -> None:
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


def simulate(datasets: dict[str, pd.DataFrame]) -> tuple[list[DayResult], list[Position]]:
    state    = PortfolioState(balance=INITIAL_CAPITAL, day_start_balance=INITIAL_CAPITAL)
    risk     = PortfolioRiskManager(state)
    strategy = AMMRStrategy()
    executor = PaperExecutor()
    closed: list[Position] = []

    ref_df = datasets[PAIRS[0]]
    n      = len(ref_df)

    current_day   = None
    day_start_bal = INITIAL_CAPITAL
    day_start_idx = 0  # closed[] index at start of each day
    day_num       = 0
    results: list[DayResult] = []

    def _snapshot(the_day: date) -> None:
        nonlocal day_num
        today = closed[day_start_idx:]
        wins  = sum(1 for p in today if p.status == PositionStatus.CLOSED_TP)
        bal_end  = state.balance
        pnl      = bal_end - day_start_bal
        ret_pct  = pnl / day_start_bal * 100
        cum_pct  = (bal_end - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100
        open_cnt = state.open_count
        results.append(DayResult(
            day_num=day_num, date=the_day,
            bal_start=day_start_bal, bal_end=bal_end,
            pnl=pnl, ret_pct=ret_pct, cum_ret_pct=cum_pct,
            trades_closed=len(today), wins=wins, losses=len(today) - wins,
            positions_open=open_cnt,
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
            size     = calculate_size(signal, state.balance)
            position = executor.open_position(signal, size)
            fee      = position.fill_price * position.size * BINANCE_FEE
            risk.record_fill(position, fee)

    # Close remaining open positions at last candle's close
    for pair, df in datasets.items():
        last_price = df.iloc[-1]["close"]
        for pos in list(state.open_positions):
            if pos.pair == pair and pos.status == PositionStatus.OPEN:
                pnl = executor.close_position(pos, last_price, "MANUAL")
                closed.append(pos)
                risk.record_close(pos, pnl)

    if current_day is not None:
        _snapshot(current_day)

    return results, closed


# ─── display ──────────────────────────────────────────────────────────────────

def _equity_sparkline(balances: list[float]) -> str:
    CHARS = " ▁▂▃▄▅▆▇█"
    lo, hi = min(balances), max(balances)
    if hi == lo:
        return "─" * len(balances)
    out = ""
    for b in balances:
        idx = int((b - lo) / (hi - lo) * (len(CHARS) - 1))
        out += CHARS[idx]
    return out


def display(results: list[DayResult], closed: list[Position]) -> None:
    console.print()
    console.print(Panel(
        "[bold]CryptoBot AMMR — Simulación 30 días[/bold]\n"
        f"Capital inicial: [bold]{INITIAL_CAPITAL:,.0f}€[/bold]  |  "
        f"Objetivo: [bold]{INITIAL_CAPITAL * TARGET_DAILY_PCT:.0f}€/día (2%)[/bold]\n"
        f"Pares: {', '.join(PAIRS)}  |  Timeframe: 1H  |  Compounding diario",
        border_style="blue",
    ))
    console.print()

    # ── daily table ───────────────────────────────────────────────────────────
    total_pnl = results[-1].bal_end - INITIAL_CAPITAL
    total_ret = results[-1].cum_ret_pct

    t = Table(
        title="Resultados día a día",
        box=box.SIMPLE_HEAVY,
        show_footer=True,
        footer_style="bold",
        pad_edge=False,
    )
    t.add_column("Día",      style="dim",    footer="MES",    min_width=5)
    t.add_column("Fecha",    style="dim",    footer="",       min_width=6, no_wrap=True)
    t.add_column("Inicio",   justify="right",footer="",       min_width=7, no_wrap=True)
    t.add_column("Fin",      justify="right",
                 footer=f"{results[-1].bal_end:,.0f}",        min_width=7, no_wrap=True)
    t.add_column("P&L €",   justify="right",
                 footer=f"[{'green' if total_pnl >= 0 else 'red'}]{total_pnl:+.0f}[/]",
                 min_width=8, no_wrap=True)
    t.add_column("Ret%",     justify="right",
                 footer=f"[{'green' if total_ret >= 0 else 'red'}]{total_ret:+.2f}%[/]",
                 min_width=7, no_wrap=True)
    t.add_column("Acum%",    justify="right", footer="",      min_width=7, no_wrap=True)
    t.add_column("Trades",   justify="center",
                 footer=str(sum(r.trades_closed for r in results)),  min_width=6)
    t.add_column("W/L",      justify="center", footer="",    min_width=7)
    t.add_column("~Open",    justify="center", footer="",    min_width=5)

    target = INITIAL_CAPITAL * TARGET_DAILY_PCT
    for r in results:
        hit     = r.pnl >= target
        pc      = "green" if r.pnl >= 0 else "red"
        ac      = "green" if r.cum_ret_pct >= 0 else "red"
        icon    = "★" if hit else " "
        t.add_row(
            f"{r.day_num + 1:2d}{icon}",
            r.date.strftime("%d %b"),
            f"{r.bal_start:,.0f}",
            f"{r.bal_end:,.0f}",
            f"[{pc}]{r.pnl:+.2f}[/{pc}]",
            f"[{pc}]{r.ret_pct:+.2f}%[/{pc}]",
            f"[{ac}]{r.cum_ret_pct:+.2f}%[/{ac}]",
            str(r.trades_closed) if r.trades_closed else "-",
            (f"[green]{r.wins}[/green]/[red]{r.losses}[/red]"
             if r.trades_closed else "-"),
            str(r.positions_open) if r.positions_open else "-",
        )
    console.print(t)
    console.print("  ★ = día que alcanzó el objetivo ≥2% (100€)")
    console.print()

    # ── equity curve ─────────────────────────────────────────────────────────
    balances   = [INITIAL_CAPITAL] + [r.bal_end for r in results]
    sparkline  = _equity_sparkline(balances)
    color      = "green" if balances[-1] >= INITIAL_CAPITAL else "red"
    lo, hi     = min(balances), max(balances)
    console.print("  Equity — mes completo (cada carácter = 1 día)")
    console.print(f"  [dim]{lo:,.0f}€[/dim]  [{color}]{sparkline}[/{color}]  [dim]{hi:,.0f}€[/dim]")
    console.print()

    # ── summary ───────────────────────────────────────────────────────────────
    pnl_days     = [r.pnl for r in results]
    pos_days     = sum(1 for d in pnl_days if d > 0)
    neg_days     = sum(1 for d in pnl_days if d <= 0)
    avg_pnl      = float(np.mean(pnl_days))
    best         = max(results, key=lambda r: r.pnl)
    worst        = min(results, key=lambda r: r.pnl)
    days_on_tgt  = sum(1 for r in results if r.pnl >= target)
    total_trades = len(closed)
    wins_total   = sum(1 for p in closed if p.status == PositionStatus.CLOSED_TP)
    losses_total = total_trades - wins_total
    wr           = wins_total / total_trades * 100 if total_trades else 0.0

    wins_pnl  = [p.realized_pnl for p in closed if p.realized_pnl > 0]
    loss_pnl  = [p.realized_pnl for p in closed if p.realized_pnl <= 0]
    gross_win = sum(wins_pnl)
    gross_los = abs(sum(loss_pnl))
    pf        = gross_win / gross_los if gross_los else float("inf")

    s = Table(box=box.MINIMAL_DOUBLE_HEAD, show_header=False)
    s.add_column("Métrica",  style="bold cyan", width=30)
    s.add_column("Valor",    justify="right")

    def row(label, val):
        s.add_row(label, val)

    row("Capital inicial",   f"{INITIAL_CAPITAL:,.0f}€")
    row("Capital final",     f"[bold]{results[-1].bal_end:,.2f}€[/bold]")
    row("P&L total",
        f"[{'green' if total_pnl >= 0 else 'red'}][bold]{total_pnl:+.2f}€[/bold][/]")
    row("Retorno total",
        f"[{'green' if total_ret >= 0 else 'red'}][bold]{total_ret:+.2f}%[/bold][/]")
    row("",                  "")
    row("P&L medio diario",  f"{avg_pnl:+.2f}€")
    row("Días positivos",    f"[green]{pos_days}/30[/green]")
    row("Días negativos",    f"[red]{neg_days}/30[/red]")
    row("Días ≥ objetivo 2%",f"[bold]{days_on_tgt}/30[/bold]")
    row("",                  "")
    row("Mejor día",
        f"Día {best.day_num + 1} ({best.date.strftime('%d %b')}): "
        f"[green]{best.pnl:+.2f}€ ({best.ret_pct:+.2f}%)[/green]")
    row("Peor día",
        f"Día {worst.day_num + 1} ({worst.date.strftime('%d %b')}): "
        f"[red]{worst.pnl:+.2f}€ ({worst.ret_pct:+.2f}%)[/red]")
    row("",                  "")
    row("Total trades",      str(total_trades))
    row("Win rate",          f"{wr:.1f}%  ({wins_total}W / {losses_total}L)")
    row("Profit factor",     f"{pf:.3f}")
    row("Avg ganancia/trade",f"+{np.mean(wins_pnl):.2f}€" if wins_pnl else "-")
    row("Avg pérdida/trade", f"{np.mean(loss_pnl):.2f}€"  if loss_pnl else "-")

    console.print(Panel(s, title="Resumen del mes", border_style="cyan"))
    console.print()

    # ── objetivo check ────────────────────────────────────────────────────────
    projected = avg_pnl * 30
    console.print(f"  Objetivo 2%/día (≥ {target:.0f}€): "
                  f"[bold]{days_on_tgt}/30 días[/bold] lo alcanzaron")
    console.print(f"  P&L medio real: [bold]{avg_pnl:+.2f}€/día[/bold]  "
                  f"→  proyección 30 días: [bold]{projected:+.0f}€[/bold]")
    if total_pnl >= 0:
        console.print(
            f"\n  [bold green]Mes cerrado en positivo:[/bold green] "
            f"+{total_pnl:.2f}€ ({total_ret:+.2f}%)"
        )
    else:
        console.print(
            f"\n  [bold red]Mes cerrado en negativo:[/bold red] "
            f"{total_pnl:.2f}€ ({total_ret:+.2f}%)"
        )
    console.print()


# ─── entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    console.print("[dim]Generando datos sintéticos (30 días × 3 pares × 24h)...[/dim]")
    datasets = build_datasets()

    p_start = {pair: datasets[pair].iloc[WARMUP_CANDLES]["close"] for pair in PAIRS}
    p_end   = {pair: datasets[pair].iloc[-1]["close"] for pair in PAIRS}
    console.print("  Precios sintéticos:")
    for pair in PAIRS:
        chg = (p_end[pair] / p_start[pair] - 1) * 100
        console.print(f"    {pair}: {p_start[pair]:,.0f} → {p_end[pair]:,.0f}  "
                      f"([{'green' if chg >= 0 else 'red'}]{chg:+.1f}%[/])")
    console.print()

    console.print("[dim]Ejecutando simulación...[/dim]")
    results, closed = simulate(datasets)

    # Keep exactly 30 trading days
    results = results[:30]
    closed_in_month = [p for p in closed if p.closed_at is not None]

    display(results, closed_in_month)
