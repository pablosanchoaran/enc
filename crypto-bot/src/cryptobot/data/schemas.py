from datetime import datetime
from enum import Enum
from pydantic import BaseModel, field_validator


class Candle(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    pair: str
    timeframe: str
    interpolated: bool = False

    @field_validator("open", "high", "low", "close", "volume")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("OHLCV values must be positive")
        return v

    @field_validator("high")
    @classmethod
    def high_gte_low(cls, v: float, info) -> float:
        data = info.data
        if "low" in data and v < data["low"]:
            raise ValueError("high must be >= low")
        return v

    @field_validator("close")
    @classmethod
    def close_between_low_and_high(cls, v: float, info) -> float:
        data = info.data
        if "low" in data and "high" in data:
            if not (data["low"] <= v <= data["high"]):
                raise ValueError("close must be between low and high")
        return v


class Direction(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class Regime(str, Enum):
    TRENDING = "TRENDING"
    RANGING = "RANGING"
    TRANSITION = "TRANSITION"


class Signal(BaseModel):
    pair: str
    direction: Direction
    entry_price: float
    stop_price: float
    take_profit_price: float
    regime: Regime
    timestamp: datetime

    @property
    def stop_distance(self) -> float:
        return abs(self.entry_price - self.stop_price)

    @property
    def reward_risk_ratio(self) -> float:
        tp_distance = abs(self.take_profit_price - self.entry_price)
        return tp_distance / self.stop_distance if self.stop_distance > 0 else 0.0


class PositionStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED_TP = "CLOSED_TP"
    CLOSED_STOP = "CLOSED_STOP"
    CLOSED_MANUAL = "CLOSED_MANUAL"


class Position(BaseModel):
    id: str
    pair: str
    direction: Direction
    entry_price: float
    fill_price: float
    size: float
    stop_price: float
    take_profit_price: float
    status: PositionStatus = PositionStatus.OPEN
    opened_at: datetime
    closed_at: datetime | None = None
    realized_pnl: float = 0.0
    exchange_order_id: str | None = None

    def unrealized_pnl(self, current_price: float) -> float:
        if self.direction == Direction.LONG:
            return (current_price - self.fill_price) * self.size
        return (self.fill_price - current_price) * self.size
