"""Mean reversion strategy for RANGING regime — Bollinger Bands + RSI."""

from datetime import datetime, timezone

import pandas as pd

from cryptobot.config.constants import BB_STOP_MULT, RSI_OVERBOUGHT, RSI_OVERSOLD, TAKE_PROFIT_MULT
from cryptobot.data.schemas import Direction, Regime, Signal
from cryptobot.indicators.oscillators import rsi
from cryptobot.indicators.volatility import bollinger_bands


def mean_reversion_signal(df: pd.DataFrame, pair: str) -> Signal | None:
    """Generate a LONG or SHORT signal in ranging regime, or None."""
    if len(df) < 25:
        return None

    close = df["close"]
    bb = bollinger_bands(close)
    rsi_series = rsi(close)

    if bb is None or bb.empty:
        return None

    last_close = close.iloc[-1]
    last_lower = bb["BBL"].iloc[-1]
    last_mid = bb["BBM"].iloc[-1]
    last_upper = bb["BBU"].iloc[-1]
    last_rsi = rsi_series.iloc[-1]

    if any(pd.isna(v) for v in [last_lower, last_mid, last_upper, last_rsi]):
        return None

    band_width = last_upper - last_lower

    if last_close <= last_lower and last_rsi < RSI_OVERSOLD:
        stop = last_lower - BB_STOP_MULT * band_width
        stop_dist = last_close - stop
        tp = last_close + TAKE_PROFIT_MULT * stop_dist
        return Signal(
            pair=pair,
            direction=Direction.LONG,
            entry_price=last_close,
            stop_price=stop,
            take_profit_price=tp,
            regime=Regime.RANGING,
            timestamp=datetime.now(tz=timezone.utc),
        )

    if last_close >= last_upper and last_rsi > RSI_OVERBOUGHT:
        stop = last_upper + BB_STOP_MULT * band_width
        stop_dist = stop - last_close
        tp = last_close - TAKE_PROFIT_MULT * stop_dist
        return Signal(
            pair=pair,
            direction=Direction.SHORT,
            entry_price=last_close,
            stop_price=stop,
            take_profit_price=tp,
            regime=Regime.RANGING,
            timestamp=datetime.now(tz=timezone.utc),
        )

    return None
