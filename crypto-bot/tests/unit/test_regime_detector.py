"""Unit tests for regime detector."""

import numpy as np
import pandas as pd
import pytest

from cryptobot.data.schemas import Regime
from cryptobot.strategy.regime_detector import detect_regime


def make_trending_df(n: int = 200) -> pd.DataFrame:
    """Strong linear uptrend — produces high ADX."""
    np.random.seed(1)
    trend = np.linspace(50000, 50000 + n * 300, n)
    noise = np.random.randn(n) * 10
    close = trend + noise
    return pd.DataFrame({
        "open": close - 50,
        "high": close + 80,
        "low": close - 80,
        "close": close,
    })


def make_ranging_df(n: int = 200) -> pd.DataFrame:
    """Random walk with no trend — produces low ADX."""
    np.random.seed(42)
    # Stationary noise — zero drift
    noise = np.random.randn(n) * 20
    close = 50000 + noise
    spread = np.abs(np.random.randn(n)) * 10 + 5
    return pd.DataFrame({
        "open": close + np.random.randn(n) * 5,
        "high": close + spread,
        "low": close - spread,
        "close": close,
    })


def test_ranging_regime():
    df = make_ranging_df()
    regime = detect_regime(df)
    assert regime == Regime.RANGING


def test_trending_regime():
    df = make_trending_df()
    regime = detect_regime(df)
    assert regime == Regime.TRENDING


def test_insufficient_data_returns_transition():
    df = pd.DataFrame({"open": [1], "high": [2], "low": [0.5], "close": [1.5]})
    regime = detect_regime(df)
    assert regime == Regime.TRANSITION


def test_empty_df_returns_transition():
    df = pd.DataFrame(columns=["open", "high", "low", "close"])
    regime = detect_regime(df)
    assert regime == Regime.TRANSITION
