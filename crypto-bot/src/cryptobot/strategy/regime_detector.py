"""Market regime classification using ADX."""

import pandas as pd

from cryptobot.config.constants import ADX_PERIOD, ADX_RANGING_THRESHOLD, ADX_TRENDING_THRESHOLD
from cryptobot.data.schemas import Regime
from cryptobot.indicators.trend import adx_value


def detect_regime(df: pd.DataFrame) -> Regime:
    """Classify the current regime from the last row of df."""
    if len(df) < ADX_PERIOD + 5:
        return Regime.TRANSITION

    adx_series = adx_value(df, period=ADX_PERIOD)
    last_adx = adx_series.iloc[-1]

    if pd.isna(last_adx):
        return Regime.TRANSITION
    if last_adx >= ADX_TRENDING_THRESHOLD:
        return Regime.TRENDING
    if last_adx < ADX_RANGING_THRESHOLD:
        return Regime.RANGING
    return Regime.TRANSITION
