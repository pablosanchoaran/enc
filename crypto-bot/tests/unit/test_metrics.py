"""Unit tests for backtest metrics computation."""

from datetime import datetime, timezone

import pytest

from cryptobot.backtest.metrics import compute_metrics
from cryptobot.data.schemas import Direction, Position, PositionStatus


def make_closed_position(pnl: float, direction=Direction.LONG, status=None):
    if status is None:
        status = PositionStatus.CLOSED_TP if pnl > 0 else PositionStatus.CLOSED_STOP
    return Position(
        id=f"pos-{pnl}",
        pair="BTCUSDT",
        direction=direction,
        entry_price=65000.0,
        fill_price=65032.5,
        size=abs(pnl) / 1300.0,
        stop_price=63700.0,
        take_profit_price=67600.0,
        status=status,
        opened_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        closed_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        realized_pnl=pnl,
    )


def test_compute_metrics_empty():
    metrics = compute_metrics([], 5000.0, 30)
    assert metrics.total_trades == 0
    assert metrics.sharpe_ratio == 0


def test_compute_metrics_all_winners():
    positions = [make_closed_position(100.0) for _ in range(10)]
    metrics = compute_metrics(positions, 5000.0, 30)
    assert metrics.total_trades == 10
    assert metrics.win_rate == 100.0
    assert metrics.total_return_pct > 0


def test_compute_metrics_win_rate():
    wins = [make_closed_position(50.0) for _ in range(6)]
    losses = [make_closed_position(-30.0) for _ in range(4)]
    metrics = compute_metrics(wins + losses, 5000.0, 30)
    assert metrics.win_rate == 60.0
    assert metrics.total_trades == 10


def test_compute_metrics_profit_factor():
    wins = [make_closed_position(100.0) for _ in range(5)]  # total 500
    losses = [make_closed_position(-50.0) for _ in range(5)]  # total 250
    metrics = compute_metrics(wins + losses, 5000.0, 30)
    assert abs(metrics.profit_factor - 2.0) < 0.01


def test_compute_metrics_drawdown():
    positions = (
        [make_closed_position(100.0) for _ in range(3)] +
        [make_closed_position(-200.0) for _ in range(2)] +
        [make_closed_position(100.0) for _ in range(3)]
    )
    metrics = compute_metrics(positions, 5000.0, 30)
    assert metrics.max_drawdown_pct > 0


def test_compute_metrics_skips_open_positions():
    from cryptobot.data.schemas import PositionStatus
    open_pos = make_closed_position(0.0, status=PositionStatus.OPEN)
    closed = make_closed_position(100.0)
    metrics = compute_metrics([open_pos, closed], 5000.0, 30)
    assert metrics.total_trades == 1
