"""EMA and ADX indicators using TA-Lib."""

import numpy as np
import pandas as pd
import talib

from cryptobot.config.constants import (
    ADX_PERIOD, EMA_FAST_PERIOD, EMA_SLOW_PERIOD,
)


def ema(series: pd.Series, period: int) -> pd.Series:
    result = talib.EMA(series.values.astype(float), timeperiod=period)
    return pd.Series(result, index=series.index)


def adx_value(df: pd.DataFrame, period: int = ADX_PERIOD) -> pd.Series:
    """Return ADX series."""
    result = talib.ADX(
        df["high"].values.astype(float),
        df["low"].values.astype(float),
        df["close"].values.astype(float),
        timeperiod=period,
    )
    return pd.Series(result, index=df.index)


def ema_fast(close: pd.Series) -> pd.Series:
    return ema(close, EMA_FAST_PERIOD)


def ema_slow(close: pd.Series) -> pd.Series:
    return ema(close, EMA_SLOW_PERIOD)
