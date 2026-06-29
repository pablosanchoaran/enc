"""Portfolio-level risk enforcement: position limits, circuit breaker, min balance."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from cryptobot.config.constants import (
    DAILY_DD_LIMIT, MAX_OPEN_POSITIONS, MIN_BALANCE,
)
from cryptobot.data.schemas import Position, PositionStatus, Signal

logger = logging.getLogger(__name__)


@dataclass
class PortfolioState:
    balance: float
    day_start_balance: float
    open_positions: list[Position] = field(default_factory=list)
    circuit_breaker_active: bool = False
    trading_paused: bool = False

    @property
    def open_count(self) -> int:
        return len([p for p in self.open_positions if p.status == PositionStatus.OPEN])

    @property
    def daily_drawdown(self) -> float:
        if self.day_start_balance <= 0:
            return 0.0
        return (self.day_start_balance - self.balance) / self.day_start_balance

    def open_pairs(self) -> set[str]:
        return {p.pair for p in self.open_positions if p.status == PositionStatus.OPEN}

    def reset_day(self, new_balance: float) -> None:
        """Call at 00:00 UTC to reset daily tracking and enable compounding."""
        self.day_start_balance = new_balance
        self.balance = new_balance
        self.circuit_breaker_active = False
        logger.info("day reset balance=%.2f", new_balance)


class PortfolioRiskManager:
    def __init__(self, state: PortfolioState):
        self.state = state

    def can_open_position(self, signal: Signal) -> tuple[bool, str]:
        """Return (allowed, reason) for a proposed new position."""
        if self.state.trading_paused:
            return False, "Trading paused — balance below minimum"

        if self.state.circuit_breaker_active:
            return False, "Circuit breaker active — daily loss limit exceeded"

        if self.state.balance < MIN_BALANCE:
            self.state.trading_paused = True
            logger.critical("balance=%.2f below minimum=%.2f — trading paused", self.state.balance, MIN_BALANCE)
            return False, f"Balance {self.state.balance:.2f} below minimum {MIN_BALANCE}"

        if self.state.open_count >= MAX_OPEN_POSITIONS:
            return False, f"Max open positions ({MAX_OPEN_POSITIONS}) reached — signal rejected"

        return True, "ok"

    def check_circuit_breaker(self) -> bool:
        """Evaluate daily drawdown and activate circuit breaker if threshold exceeded."""
        dd = self.state.daily_drawdown
        if dd >= DAILY_DD_LIMIT and not self.state.circuit_breaker_active:
            self.state.circuit_breaker_active = True
            logger.critical(
                "Circuit breaker triggered: %.2f%% daily DD (limit %.2f%%)",
                dd * 100, DAILY_DD_LIMIT * 100,
            )
            return True
        return False

    def record_fill(self, position: Position, fill_cost: float) -> None:
        self.state.balance -= fill_cost
        self.state.open_positions.append(position)

    def record_close(self, position: Position, pnl: float) -> None:
        self.state.balance += pnl
        position.status = PositionStatus.CLOSED_TP if pnl > 0 else PositionStatus.CLOSED_STOP
        self.check_circuit_breaker()
