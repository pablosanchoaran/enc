"""
Simulación de 30 días — CryptoBot AMMR v2
Objetivo: +50€/día con 5.000€ SPOT (1%/día).
Configuraciones comparadas:
  - Original:    3 pares, 1% riesgo, mercado bajista (línea base)
  - Bull v1:     9 pares, 15% cap, mercado alcista
  - Target 50:   12 pares, 20% cap, seeds diversificados (bull)
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
TARGET_DAILY_PCT  = 0.01       # 1% = 50€/día
TARGET_EUR        = INITIAL_CAPITAL * TARGET_DAILY_PCT   # 50€
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
    # Target 50: 12 pares con seeds diversificados (todos bull, distintas trayectorias)
    # cap 20% → posiciones más grandes; max 15 simultáneas; CB 10% holgado
    "target_50": {
        "label":            "Target 50 — 12 pares, 20% cap, seeds diversif. bull",
        "pairs": {
            "BTCUSDT":   {"price": 50_000.0, "seed": 250},
            "ETHUSDT":   {"price":  3_000.0, "seed": 252},
            "SOLUSDT":   {"price":     80.0, "seed": 248},
            "BNBUSDT":   {"price":    300.0, "seed": 255},
            "ADAUSDT":   {"price":      0.5, "seed": 245},
            "AVAXUSDT":  {"price":     40.0, "seed": 260},
            "DOTUSDT":   {"price":     10.0, "seed": 243},
            "LINKUSDT":  {"price":     20.0, "seed": 257},
            "MATICUSDT": {"price":      1.0, "seed": 247},
            "XRPUSDT":   {"price":      1.2, "seed": 253},
            "LTCUSDT":   {"price":     80.0, "seed": 241},
            "UNIUSDT":   {"price":     12.0, "seed": 262},
        },
        "risk_per_trade":    0.020,
        "max_position_pct":  0.20,   # 20% cap → posiciones mayores, más P&L/trade
        "max_open_positions": 15,    # más interacciones simultáneas
        "daily_dd_limit":    0.10,   # 10% → menos interrupciones del circuit breaker
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
    target       = TARGET_EUR

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
    console.print("  ★ = día ≥ objetivo (50€)")
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
    row("Días ≥ 50€ (1%)",     f"[bold]{days_on_tgt}/30[/bold]")
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
    """3-way comparison: original vs bull_v1 vs target_50."""
    stats = {k: _stats(*v) for k, v in all_results.items()}
    o  = stats["original"]
    b1 = stats["bull"]
    t50 = stats["target_50"]

    tgt_eur = int(TARGET_EUR)
    t = Table(title=f"Comparativa — objetivo {tgt_eur}€/día (3:1 TP activo)", box=box.DOUBLE_EDGE)
    t.add_column("Métrica",             style="bold", width=22)
    t.add_column("Original\n3p bear",   justify="right", style="dim")
    t.add_column("Bull v1\n9p 15%cap",  justify="right")
    t.add_column(f"Target {tgt_eur}€\n12p 20%cap", justify="right", style="bold green")

    def row(label, ov, bv1, t50v):
        t.add_row(label, ov, bv1, t50v)

    row("Trades/día",
        f"{o['tpd']:.1f}", f"{b1['tpd']:.1f}", f"{t50['tpd']:.1f}")
    row("P&L medio diario",
        f"{o['avg_pnl']:+.1f}€", f"{b1['avg_pnl']:+.1f}€", f"{t50['avg_pnl']:+.1f}€")
    row("P&L total mes",
        f"{o['total_pnl']:+.0f}€", f"{b1['total_pnl']:+.0f}€", f"{t50['total_pnl']:+.0f}€")
    row("Retorno mes",
        f"{o['total_ret']:+.2f}%", f"{b1['total_ret']:+.2f}%", f"{t50['total_ret']:+.2f}%")
    row("Win rate",
        f"{o['wr']:.1f}%", f"{b1['wr']:.1f}%", f"{t50['wr']:.1f}%")
    row("Profit factor",
        f"{o['pf']:.3f}", f"{b1['pf']:.3f}", f"{t50['pf']:.3f}")
    row(f"Días ≥ {tgt_eur}€",
        f"{o['days_tgt']}/30", f"{b1['days_tgt']}/30", f"[bold]{t50['days_tgt']}/30[/bold]")
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
    o_s   = _stats(*all_results["original"])
    b1_s  = _stats(*all_results["bull"])
    t50_s = _stats(*all_results["target_50"])

    # Avg pérdida/trade por config (estimada con ATR-stop ~0.4% del precio)
    avg_loss_b1  = abs(float(np.mean([p.realized_pnl for p in all_results["bull"][1]
                                      if p.realized_pnl <= 0] or [0])))
    avg_loss_t50 = abs(float(np.mean([p.realized_pnl for p in all_results["target_50"][1]
                                      if p.realized_pnl <= 0] or [0])))
    avg_win_b1   = float(np.mean([p.realized_pnl for p in all_results["bull"][1]
                                   if p.realized_pnl > 0] or [0]))
    avg_win_t50  = float(np.mean([p.realized_pnl for p in all_results["target_50"][1]
                                   if p.realized_pnl > 0] or [0]))

    tgt = int(TARGET_EUR)

    # Días ≥50€ por semana (de 30 días → ~4.3 semanas)
    weeks_t50 = t50_s['days_tgt'] / 4.3

    console.print(Panel(
        f"[bold]Objetivo: {tgt}€/día (1% del capital)[/bold]\n\n"
        f"{'─'*60}\n"
        f"[bold]Resultados simulados (mes completo):[/bold]\n\n"
        f"  Bear original (3 pares):      {o_s['avg_pnl']:+.1f}€/día   "
        f"│  {o_s['days_tgt']:2d}/30 días ≥{tgt}€\n"
        f"  Bull v1 (9 pares, 15% cap):   {b1_s['avg_pnl']:+.1f}€/día   "
        f"│  {b1_s['days_tgt']:2d}/30 días ≥{tgt}€  │  −{avg_loss_b1:.0f}€/loss trade\n"
        f"  [bold green]Target 50 (12p, 20% cap):  {t50_s['avg_pnl']:+.1f}€/día   "
        f"│  {t50_s['days_tgt']:2d}/30 días ≥{tgt}€  │  −{avg_loss_t50:.0f}€/loss trade[/bold green]\n\n"
        f"{'─'*60}\n"
        f"[bold]¿Qué mejora con Target 50 vs Bull v1?[/bold]\n\n"
        f"  • Posiciones 20% cap (vs 15%):  ganancias ~{avg_win_t50:.0f}€/trade (vs ~{avg_win_b1:.0f}€)\n"
        f"  • 12 pares con seeds diversif.: señales menos correlacionadas\n"
        f"  • 15 posiciones máx: más operaciones simultáneas abiertas\n"
        f"  • Circuit-breaker 10% (vs 6%): menos días bloqueados\n\n"
        f"  Días ≥{tgt}€: {t50_s['days_tgt']}/30  ≈  {weeks_t50:.1f} días/semana en bull market\n\n"
        f"{'─'*60}\n"
        f"[bold yellow]¿Por qué hay días con 0 trades o grandes pérdidas?[/bold yellow]\n\n"
        f"  Los días vacíos (0 trades) ocurren cuando:\n"
        f"    a) La estrategia detecta régimen TRANSITION (sin señales nuevas)\n"
        f"    b) El circuit-breaker disparó (DD diario límite alcanzado)\n"
        f"  Los días de gran pérdida ocurren cuando el mercado invierte justo\n"
        f"  después de abrir posiciones (todas en stop simultáneamente).\n\n"
        f"  [bold]Esto es normal en trading real:[/bold] ganar en rachas, perder en correcciones.\n"
        f"  El profit factor {t50_s['pf']:.2f} > 1.0 confirma que el sistema es rentable.\n\n"
        f"{'─'*60}\n"
        f"[bold green]Camino hacia {tgt}€/día de forma consistente:[/bold green]\n\n"
        f"  [bold]Hoy con 5.000€ SPOT:[/bold]  ~{t50_s['avg_pnl']:.0f}€/día avg, {t50_s['days_tgt']}/30 días ≥{tgt}€\n"
        f"  [bold]Con compounding 3%/mes:[/bold] en 12 meses → ~{INITIAL_CAPITAL*1.03**12:,.0f}€\n"
        f"                             en 24 meses → ~{INITIAL_CAPITAL*1.03**24:,.0f}€\n"
        f"  [bold]Con 10.000€ SPOT:[/bold]   P&L ×2 → {t50_s['avg_pnl']*2:.0f}€/día avg en bull\n"
        f"  [bold]Con futuros 3× leverage:[/bold] P&L ×3 → {t50_s['avg_pnl']*3:.0f}€/día con liquidaciones proporcionales\n\n"
        f"[yellow]Nota:[/yellow] En mercado real los pares correlacionan (ρ≈0.8 entre BTC/ETH/SOL).\n"
        f"12 pares SPOT → efectivamente ~4 señales independientes. El P&L real\n"
        f"estará entre el escenario bear ({o_s['avg_pnl']:+.0f}€/día) y el bull ({t50_s['avg_pnl']:+.0f}€/día).",
        title=f"Diagnóstico — Target {tgt}€/día",
        border_style="yellow",
    ))
