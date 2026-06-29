"""Paper executor — simulates fills and P&L without hitting the exchange."""

import uuid
from datetime import datetime, timezone

from cryptobot.config.constants import PAPER_SLIPPAGE
from cryptobot.data.schemas import Direction, Position, PositionStatus, Signal
from cryptobot.execution.base_executor import BaseExecutor


class PaperExecutor(BaseExecutor):
    def open_position(self, signal: Signal, size: float) -> Position:
        if signal.direction == Direction.LONG:
            fill_price = signal.entry_price * (1 + PAPER_SLIPPAGE)
        else:
            fill_price = signal.entry_price * (1 - PAPER_SLIPPAGE)

        return Position(
            id=str(uuid.uuid4()),
            pair=signal.pair,
            direction=signal.direction,
            entry_price=signal.entry_price,
            fill_price=fill_price,
            size=size,
            stop_price=signal.stop_price,
            take_profit_price=signal.take_profit_price,
            status=PositionStatus.OPEN,
            opened_at=datetime.now(tz=timezone.utc),
        )

    def close_position(self, position: Position, close_price: float, reason: str) -> float:
        if position.direction == Direction.LONG:
            pnl = (close_price - position.fill_price) * position.size
        else:
            pnl = (position.fill_price - close_price) * position.size

        position.realized_pnl = pnl
        position.closed_at = datetime.now(tz=timezone.utc)
        if reason == "STOP":
            position.status = PositionStatus.CLOSED_STOP
        elif reason == "TP":
            position.status = PositionStatus.CLOSED_TP
        else:
            position.status = PositionStatus.CLOSED_MANUAL

        return pnl

    def update_stop(self, position: Position, new_stop: float) -> None:
        position.stop_price = new_stop
