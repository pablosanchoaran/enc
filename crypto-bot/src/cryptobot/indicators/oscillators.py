"""RSI oscillator using TA-Lib."""

import pandas as pd
import talib

from cryptobot.config.constants import RSI_PERIOD


def rsi(close: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    result = talib.RSI(close.values.astype(float), timeperiod=period)
    return pd.Series(result, index=close.index)
