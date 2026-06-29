"""Unit tests for portfolio risk manager — circuit breaker and position limits."""

from datetime import datetime, timezone

import pytest

from cryptobot.data.schemas import Direction, Position, PositionStatus, Regime, Signal
from cryptobot.risk.portfolio import PortfolioRiskManager, PortfolioState


def make_state(balance=5000.0):
    return PortfolioState(balance=balance, day_start_balance=balance)


def make_signal(pair="BTCUSDT"):
    return Signal(
        pair=pair,
        direction=Direction.LONG,
        entry_price=65000.0,
        stop_price=63700.0,
        take_profit_price=67600.0,
        regime=Regime.TRENDING,
        timestamp=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )


def open_position(pair="BTCUSDT"):
    return Position(
        id=f"pos-{pair}",
        pair=pair,
        direction=Direction.LONG,
        entry_price=65000.0,
        fill_price=65032.5,
        size=0.038,
        stop_price=63700.0,
        take_profit_price=67600.0,
        status=PositionStatus.OPEN,
        opened_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )


def test_can_open_position_when_empty():
    state = make_state()
    risk = PortfolioRiskManager(state)
    allowed, reason = risk.can_open_position(make_signal())
    assert allowed
    assert reason == "ok"


def test_blocked_at_max_positions():
    state = make_state()
    state.open_positions = [open_position("BTCUSDT"), open_position("ETHUSDT"), open_position("SOLUSDT")]
    risk = PortfolioRiskManager(state)
    allowed, reason = risk.can_open_position(make_signal("BTCUSDT"))
    assert not allowed
    assert "Max open positions" in reason


def test_circuit_breaker_triggers_at_3pct():
    state = make_state(balance=5000.0)
    state.balance = 5000.0 - 152.0  # 3.04% loss
    risk = PortfolioRiskManager(state)
    triggered = risk.check_circuit_breaker()
    assert triggered
    assert state.circuit_breaker_active


def test_circuit_breaker_not_triggered_below_threshold():
    state = make_state(balance=5000.0)
    state.balance = 5000.0 - 100.0  # 2% loss — under threshold
    risk = PortfolioRiskManager(state)
    triggered = risk.check_circuit_breaker()
    assert not triggered
    assert not state.circuit_breaker_active


def test_circuit_breaker_blocks_new_trades():
    state = make_state(balance=5000.0)
    state.balance = 4800.0
    state.circuit_breaker_active = True
    risk = PortfolioRiskManager(state)
    allowed, reason = risk.can_open_position(make_signal())
    assert not allowed
    assert "Circuit breaker" in reason


def test_balance_below_minimum_pauses_trading():
    state = make_state(balance=1950.0)
    risk = PortfolioRiskManager(state)
    allowed, reason = risk.can_open_position(make_signal())
    assert not allowed
    assert "minimum" in reason.lower()
    assert state.trading_paused


def test_daily_reset_compounding():
    state = make_state(balance=5100.0)
    state.reset_day(5100.0)
    assert state.day_start_balance == 5100.0
    assert not state.circuit_breaker_active


def test_open_pairs_returns_correct_set():
    state = make_state()
    state.open_positions = [open_position("BTCUSDT"), open_position("ETHUSDT")]
    assert state.open_pairs() == {"BTCUSDT", "ETHUSDT"}


def test_daily_drawdown_calculation():
    state = make_state(balance=5000.0)
    state.balance = 4850.0
    assert abs(state.daily_drawdown - 0.03) < 0.001
