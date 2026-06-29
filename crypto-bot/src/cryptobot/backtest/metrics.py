"""Performance metrics computation from a list of closed positions."""

import math
from dataclasses import dataclass

import numpy as np

from cryptobot.data.schemas import Position, PositionStatus


@dataclass
class BacktestMetrics:
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    profit_factor: float
    avg_winner_pct: float
    avg_loser_pct: float
    total_return_pct: float
    annualized_return_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown_pct: float
    max_drawdown_duration_days: int
    trades_per_day: float
    initial_capital: float
    final_capital: float


def compute_metrics(
    positions: list[Position],
    initial_capital: float,
    trading_days: float,
) -> BacktestMetrics:
    closed = [p for p in positions if p.status != PositionStatus.OPEN]
    if not closed:
        return BacktestMetrics(
            total_trades=0, winning_trades=0, losing_trades=0,
            win_rate=0, profit_factor=0, avg_winner_pct=0, avg_loser_pct=0,
            total_return_pct=0, annualized_return_pct=0,
            sharpe_ratio=0, sortino_ratio=0, calmar_ratio=0,
            max_drawdown_pct=0, max_drawdown_duration_days=0,
            trades_per_day=0, initial_capital=initial_capital, final_capital=initial_capital,
        )

    pnls = [p.realized_pnl for p in closed]
    winners = [p for p in pnls if p > 0]
    losers = [p for p in pnls if p <= 0]

    win_rate = len(winners) / len(pnls) * 100
    gross_profit = sum(winners)
    gross_loss = abs(sum(losers))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    avg_winner_pct = (np.mean(winners) / initial_capital * 100) if winners else 0.0
    avg_loser_pct = (np.mean(losers) / initial_capital * 100) if losers else 0.0

    # Equity curve for drawdown and Sharpe
    equity = [initial_capital]
    for pnl in pnls:
        equity.append(equity[-1] + pnl)
    final_capital = equity[-1]

    total_return = (final_capital - initial_capital) / initial_capital * 100
    years = trading_days / 365
    annualized = ((final_capital / initial_capital) ** (1 / years) - 1) * 100 if years > 0 else 0.0

    daily_returns = np.diff(equity) / equity[:-1]
    mean_daily = np.mean(daily_returns)
    std_daily = np.std(daily_returns, ddof=1)
    sharpe = (mean_daily / std_daily * math.sqrt(252)) if std_daily > 0 else 0.0

    downside = daily_returns[daily_returns < 0]
    sortino_std = np.std(downside, ddof=1) if len(downside) > 1 else 0.0
    sortino = (mean_daily / sortino_std * math.sqrt(252)) if sortino_std > 0 else 0.0

    # Max drawdown
    peak = equity[0]
    max_dd = 0.0
    dd_start = 0
    max_dd_duration = 0
    current_dd_start = 0
    for i, val in enumerate(equity):
        if val > peak:
            peak = val
            current_dd_start = i
        dd = (peak - val) / peak
        if dd > max_dd:
            max_dd = dd
            dd_start = current_dd_start
            max_dd_duration = i - dd_start

    calmar = annualized / (max_dd * 100) if max_dd > 0 else 0.0

    return BacktestMetrics(
        total_trades=len(closed),
        winning_trades=len(winners),
        losing_trades=len(losers),
        win_rate=round(win_rate, 2),
        profit_factor=round(profit_factor, 3),
        avg_winner_pct=round(avg_winner_pct, 3),
        avg_loser_pct=round(avg_loser_pct, 3),
        total_return_pct=round(total_return, 2),
        annualized_return_pct=round(annualized, 2),
        sharpe_ratio=round(sharpe, 3),
        sortino_ratio=round(sortino, 3),
        calmar_ratio=round(calmar, 3),
        max_drawdown_pct=round(max_dd * 100, 2),
        max_drawdown_duration_days=max_dd_duration,
        trades_per_day=round(len(closed) / trading_days, 2) if trading_days > 0 else 0,
        initial_capital=initial_capital,
        final_capital=round(final_capital, 2),
    )
