"""Unit tests for paper executor — fill simulation and P&L."""

from datetime import datetime, timezone

import pytest

from cryptobot.config.constants import PAPER_SLIPPAGE
from cryptobot.data.schemas import Direction, PositionStatus, Regime, Signal
from cryptobot.execution.paper_executor import PaperExecutor


def make_signal(direction=Direction.LONG):
    return Signal(
        pair="BTCUSDT",
        direction=direction,
        entry_price=65000.0,
        stop_price=63700.0,
        take_profit_price=67600.0,
        regime=Regime.TRENDING,
        timestamp=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )


def test_long_fill_price_includes_slippage():
    executor = PaperExecutor()
    signal = make_signal(Direction.LONG)
    pos = executor.open_position(signal, 0.038)
    expected_fill = 65000.0 * (1 + PAPER_SLIPPAGE)
    assert abs(pos.fill_price - expected_fill) < 0.01


def test_short_fill_price_includes_slippage():
    executor = PaperExecutor()
    signal = make_signal(Direction.SHORT)
    pos = executor.open_position(signal, 0.038)
    expected_fill = 65000.0 * (1 - PAPER_SLIPPAGE)
    assert abs(pos.fill_price - expected_fill) < 0.01


def test_open_position_status_is_open():
    executor = PaperExecutor()
    pos = executor.open_position(make_signal(), 0.038)
    assert pos.status == PositionStatus.OPEN


def test_no_exchange_order_id_in_paper():
    executor = PaperExecutor()
    pos = executor.open_position(make_signal(), 0.038)
    assert pos.exchange_order_id is None


def test_close_position_stop():
    executor = PaperExecutor()
    signal = make_signal(Direction.LONG)
    pos = executor.open_position(signal, 1.0)
    pnl = executor.close_position(pos, 63700.0, "STOP")
    assert pnl < 0
    assert pos.status == PositionStatus.CLOSED_STOP


def test_close_position_tp():
    executor = PaperExecutor()
    signal = make_signal(Direction.LONG)
    pos = executor.open_position(signal, 1.0)
    pnl = executor.close_position(pos, 67600.0, "TP")
    assert pnl > 0
    assert pos.status == PositionStatus.CLOSED_TP


def test_update_stop_modifies_position():
    executor = PaperExecutor()
    pos = executor.open_position(make_signal(), 0.038)
    executor.update_stop(pos, 64000.0)
    assert pos.stop_price == 64000.0


def test_ammr_strategy_does_not_import_executors():
    """Verify strategy code is agnostic to execution mode (US-15)."""
    import importlib
    import sys

    mod = importlib.import_module("cryptobot.strategy.ammr")
    source_file = mod.__file__
    with open(source_file) as f:
        source = f.read()
    assert "paper_executor" not in source
    assert "live_executor" not in source
