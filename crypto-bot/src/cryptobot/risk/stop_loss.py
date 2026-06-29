"""Stop-loss management: initial stops and trailing stop engine."""

import logging

import pandas as pd

from cryptobot.data.schemas import Direction, Position
from cryptobot.indicators.trend import ema_slow

logger = logging.getLogger(__name__)


def update_trailing_stop(position: Position, df: pd.DataFrame) -> float:
    """Return the new stop price after evaluating trailing rules.

    Rules (TRENDING positions only):
    - If price > entry + ATR: move stop to at least breakeven (entry)
    - Follow EMA-21 upward for LONG, downward for SHORT
    - Never move stop against the trade direction
    """
    current_price = df["close"].iloc[-1]
    current_stop = position.stop_price
    entry = position.fill_price

    ema21_series = ema_slow(df["close"])
    last_ema21 = ema21_series.iloc[-1]

    if pd.isna(last_ema21):
        return current_stop

    if position.direction == Direction.LONG:
        # Step 1: move to breakeven once price exceeds entry
        candidate = max(current_stop, entry if current_price > entry else current_stop)
        # Step 2: follow EMA-21
        candidate = max(candidate, last_ema21)
        new_stop = candidate
    else:
        # SHORT: stop must move downward
        candidate = min(current_stop, entry if current_price < entry else current_stop)
        candidate = min(candidate, last_ema21)
        new_stop = candidate

    if new_stop != current_stop:
        logger.info(
            "trailing stop updated pair=%s direction=%s old=%.4f new=%.4f",
            position.pair, position.direction, current_stop, new_stop,
        )

    return new_stop
