"""Unit tests for OHLCV Candle and Signal schemas."""

from datetime import datetime, timezone

import pytest

from cryptobot.data.schemas import Candle, Direction, Position, PositionStatus, Regime, Signal


def make_candle(**kwargs):
    defaults = dict(
        timestamp=datetime(2024, 1, 1, tzinfo=timezone.utc),
        open=100.0, high=110.0, low=90.0, close=105.0, volume=1000.0,
        pair="BTCUSDT", timeframe="1h",
    )
    defaults.update(kwargs)
    return Candle(**defaults)


def test_candle_valid():
    c = make_candle()
    assert c.close == 105.0
    assert c.interpolated is False


def test_candle_rejects_negative_price():
    with pytest.raises(Exception):
        make_candle(open=-1.0)


def test_candle_rejects_close_above_high():
    with pytest.raises(Exception):
        make_candle(high=100.0, close=110.0)


def test_candle_rejects_high_below_low():
    with pytest.raises(Exception):
        make_candle(high=80.0, low=90.0)


def make_signal(**kwargs):
    defaults = dict(
        pair="BTCUSDT",
        direction=Direction.LONG,
        entry_price=65000.0,
        stop_price=63700.0,
        take_profit_price=67600.0,
        regime=Regime.TRENDING,
        timestamp=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(kwargs)
    return Signal(**defaults)


def test_signal_stop_distance():
    s = make_signal()
    assert abs(s.stop_distance - 1300.0) < 0.01


def test_signal_reward_risk_ratio():
    s = make_signal()
    assert abs(s.reward_risk_ratio - 2.0) < 0.01


def test_signal_short_stop_distance():
    s = make_signal(direction=Direction.SHORT, stop_price=66300.0, take_profit_price=62400.0)
    assert abs(s.stop_distance - 1300.0) < 0.01


def test_position_unrealized_pnl_long():
    pos = Position(
        id="test",
        pair="ETHUSDT",
        direction=Direction.LONG,
        entry_price=3500.0,
        fill_price=3500.0,
        size=0.714,
        stop_price=3300.0,
        take_profit_price=3900.0,
        status=PositionStatus.OPEN,
        opened_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    pnl = pos.unrealized_pnl(3640.0)
    assert abs(pnl - 99.96) < 0.1


def test_position_unrealized_pnl_short():
    pos = Position(
        id="test2",
        pair="SOLUSDT",
        direction=Direction.SHORT,
        entry_price=160.0,
        fill_price=160.0,
        size=1.0,
        stop_price=168.0,
        take_profit_price=140.0,
        status=PositionStatus.OPEN,
        opened_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    pnl = pos.unrealized_pnl(155.0)
    assert abs(pnl - 5.0) < 0.01
