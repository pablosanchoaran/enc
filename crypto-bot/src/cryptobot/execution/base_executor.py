"""Abstract executor interface — the only seam between strategy and execution mode."""

from abc import ABC, abstractmethod

from cryptobot.data.schemas import Position, Signal


class BaseExecutor(ABC):
    @abstractmethod
    def open_position(self, signal: Signal, size: float) -> Position:
        """Place an order (real or simulated) and return the resulting Position."""
        ...

    @abstractmethod
    def close_position(self, position: Position, close_price: float, reason: str) -> float:
        """Close a position and return realized PnL in EUR."""
        ...

    @abstractmethod
    def update_stop(self, position: Position, new_stop: float) -> None:
        """Update the stop-loss price for an open position."""
        ...
