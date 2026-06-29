"""Abstract base strategy and typed signal dataclasses."""

from abc import ABC, abstractmethod
from datetime import datetime

import pandas as pd

from cryptobot.data.schemas import Signal


class BaseStrategy(ABC):
    @abstractmethod
    def generate_signal(
        self,
        df: pd.DataFrame,
        pair: str,
        open_pairs: set[str],
    ) -> Signal | None:
        """Evaluate the latest candle and return a Signal or None."""
        ...
