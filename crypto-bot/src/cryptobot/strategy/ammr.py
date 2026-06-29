"""AMMR orchestrator — regime detection + strategy dispatch.

This module knows nothing about execution mode (backtest/paper/live).
It only produces Signal objects or None.
"""

import logging

import pandas as pd

from cryptobot.data.schemas import Regime, Signal
from cryptobot.strategy.base import BaseStrategy
from cryptobot.strategy.mean_reversion import mean_reversion_signal
from cryptobot.strategy.momentum import momentum_signal
from cryptobot.strategy.regime_detector import detect_regime

logger = logging.getLogger(__name__)


class AMMRStrategy(BaseStrategy):
    def generate_signal(
        self,
        df: pd.DataFrame,
        pair: str,
        open_pairs: set[str],
    ) -> Signal | None:
        if pair in open_pairs:
            logger.debug("%s already has an open position — skipping signal", pair)
            return None

        regime = detect_regime(df)

        if regime == Regime.TRENDING:
            signal = momentum_signal(df, pair)
        elif regime == Regime.RANGING:
            signal = mean_reversion_signal(df, pair)
        else:
            logger.info("Regime TRANSITION — skipping signal for %s", pair)
            return None

        if signal:
            logger.info(
                "signal generated pair=%s direction=%s regime=%s entry=%.4f stop=%.4f tp=%.4f",
                pair, signal.direction, regime, signal.entry_price,
                signal.stop_price, signal.take_profit_price,
            )
        return signal
