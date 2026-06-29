"""Bollinger Bands and ATR using TA-Lib."""

import pandas as pd
import talib

from cryptobot.config.constants import ATR_PERIOD, BB_PERIOD, BB_STD


def bollinger_bands(close: pd.Series, period: int = BB_PERIOD, std: float = BB_STD) -> pd.DataFrame:
    """Returns DataFrame with columns: BBU, BBM, BBL (upper, mid, lower)."""
    upper, mid, lower = talib.BBANDS(close.values.astype(float), timeperiod=period, nbdevup=std, nbdevdn=std)
    return pd.DataFrame(
        {"BBU": upper, "BBM": mid, "BBL": lower},
        index=close.index,
    )


def atr(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    result = talib.ATR(
        df["high"].values.astype(float),
        df["low"].values.astype(float),
        df["close"].values.astype(float),
        timeperiod=period,
    )
    return pd.Series(result, index=df.index)
