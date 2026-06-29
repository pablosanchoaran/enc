"""Unit tests for position sizer — compounding and risk limits."""

from datetime import datetime, timezone

import pytest

from cryptobot.data.schemas import Direction, Regime, Signal
from cryptobot.risk.position_sizer import calculate_size, risk_amount


def make_signal(entry=65000.0, stop=63700.0, tp=67600.0):
    return Signal(
        pair="BTCUSDT",
        direction=Direction.LONG,
        entry_price=entry,
        stop_price=stop,
        take_profit_price=tp,
        regime=Regime.TRENDING,
        timestamp=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )


def test_risk_amount_1pct():
    assert abs(risk_amount(5000.0) - 50.0) < 0.01


def test_risk_amount_compounding():
    # After a profitable day, balance grows and risk amount grows
    assert risk_amount(5100.0) > risk_amount(5000.0)
    assert abs(risk_amount(5100.0) - 51.0) < 0.01


def test_position_size_basic():
    # stop distance 5000 (7.7% of entry) — large enough that 30% cap doesn't bind
    signal = make_signal(entry=65000.0, stop=60000.0, tp=75000.0)
    size = calculate_size(signal, 5000.0)
    max_loss = size * 5000.0
    assert abs(max_loss - 50.0) < 0.5


def test_position_size_capped_at_30pct():
    # Very tight stop → size would exceed 30% cap
    signal = make_signal(entry=65000.0, stop=64999.0)  # stop distance 1
    size = calculate_size(signal, 5000.0)
    position_value = size * signal.entry_price
    assert position_value <= 5000.0 * 0.30 + 0.01


def test_position_size_compounding_grows():
    signal = make_signal()
    size_5k = calculate_size(signal, 5000.0)
    size_5k100 = calculate_size(signal, 5100.0)
    assert size_5k100 > size_5k


def test_position_size_zero_stop_raises():
    signal = make_signal(entry=65000.0, stop=65000.0)
    with pytest.raises(ValueError, match="stop_distance"):
        calculate_size(signal, 5000.0)
