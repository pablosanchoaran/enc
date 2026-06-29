"""Momentum strategy for TRENDING regime — EMA crossover + breakout + RSI filter."""

from datetime import datetime, timezone

import pandas as pd

from cryptobot.config.constants import (
    ATR_PERIOD, BREAKOUT_LOOKBACK, EMA_FAST_PERIOD, EMA_SLOW_PERIOD,
    RSI_MOMENTUM_HIGH, RSI_MOMENTUM_LOW, TAKE_PROFIT_MULT,
)
from cryptobot.data.schemas import Direction, Regime, Signal
from cryptobot.indicators.oscillators import rsi
from cryptobot.indicators.trend import ema_fast, ema_slow
from cryptobot.indicators.volatility import atr


def momentum_signal(df: pd.DataFrame, pair: str) -> Signal | None:
    """Generate a LONG or SHORT signal in trending regime, or None."""
    if len(df) < max(EMA_SLOW_PERIOD, BREAKOUT_LOOKBACK, ATR_PERIOD) + 5:
        return None

    close = df["close"]
    ema8 = ema_fast(close)
    ema21 = ema_slow(close)
    rsi_series = rsi(close)
    atr_series = atr(df)

    last_ema8 = ema8.iloc[-1]
    last_ema21 = ema21.iloc[-1]
    last_rsi = rsi_series.iloc[-1]
    last_close = close.iloc[-1]
    last_atr = atr_series.iloc[-1]

    if any(pd.isna(v) for v in [last_ema8, last_ema21, last_rsi, last_atr]):
        return None

    rolling_high = close.rolling(BREAKOUT_LOOKBACK).max().iloc[-2]
    rolling_low = close.rolling(BREAKOUT_LOOKBACK).min().iloc[-2]

    # LONG: price breaks above recent high + EMA8 > EMA21 + RSI not overbought
    if (
        last_ema8 > last_ema21
        and last_close > rolling_high
        and RSI_MOMENTUM_LOW <= last_rsi <= RSI_MOMENTUM_HIGH
    ):
        stop = last_ema21 - last_atr
        tp = last_close + TAKE_PROFIT_MULT * (last_close - stop)
        return Signal(
            pair=pair,
            direction=Direction.LONG,
            entry_price=last_close,
            stop_price=stop,
            take_profit_price=tp,
            regime=Regime.TRENDING,
            timestamp=datetime.now(tz=timezone.utc),
        )

    # SHORT: price breaks below recent low + EMA8 < EMA21 + RSI not oversold
    rsi_short_low = 30
    rsi_short_high = 55
    if (
        last_ema8 < last_ema21
        and last_close < rolling_low
        and rsi_short_low <= last_rsi <= rsi_short_high
    ):
        stop = last_ema21 + last_atr
        tp = last_close - TAKE_PROFIT_MULT * (stop - last_close)
        return Signal(
            pair=pair,
            direction=Direction.SHORT,
            entry_price=last_close,
            stop_price=stop,
            take_profit_price=tp,
            regime=Regime.TRENDING,
            timestamp=datetime.now(tz=timezone.utc),
        )

    return None
