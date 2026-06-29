"""Live executor — places real orders on Binance SPOT with OCO stop/take-profit."""

import logging
import time
import uuid
from datetime import datetime, timezone

from binance.client import Client
from binance.exceptions import BinanceAPIException

from cryptobot.config.constants import LIVE_ORDER_MAX_RETRIES
from cryptobot.config.settings import get_settings
from cryptobot.data.schemas import Direction, Position, PositionStatus, Signal
from cryptobot.execution.base_executor import BaseExecutor

logger = logging.getLogger(__name__)


class LiveExecutor(BaseExecutor):
    def __init__(self, api_key: str | None = None, secret_key: str | None = None):
        settings = get_settings()
        self._client = Client(
            api_key=api_key or settings.binance_api_key,
            api_secret=secret_key or settings.binance_secret_key,
        )

    def _place_market_order(self, pair: str, side: str, quantity: float) -> dict:
        for attempt in range(LIVE_ORDER_MAX_RETRIES):
            try:
                order = self._client.create_order(
                    symbol=pair,
                    side=side,
                    type=Client.ORDER_TYPE_MARKET,
                    quantity=round(quantity, 6),
                )
                return order
            except BinanceAPIException as e:
                wait = 2 ** attempt
                logger.warning("order attempt %d failed: %s — retrying in %ds", attempt + 1, e, wait)
                time.sleep(wait)
        raise RuntimeError(f"Failed to place {side} order for {pair} after {LIVE_ORDER_MAX_RETRIES} retries")

    def open_position(self, signal: Signal, size: float) -> Position:
        side = "BUY" if signal.direction == Direction.LONG else "SELL"
        order = self._place_market_order(signal.pair, side, size)

        fill_price = float(order.get("fills", [{}])[0].get("price", signal.entry_price))

        self._client.create_oco_order(
            symbol=signal.pair,
            side="SELL" if signal.direction == Direction.LONG else "BUY",
            quantity=round(size, 6),
            price=str(round(signal.take_profit_price, 2)),
            stopPrice=str(round(signal.stop_price, 2)),
            stopLimitPrice=str(round(signal.stop_price * 0.999, 2)),
            stopLimitTimeInForce="GTC",
        )

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
            exchange_order_id=str(order.get("orderId", "")),
        )

    def close_position(self, position: Position, close_price: float, reason: str) -> float:
        side = "SELL" if position.direction == Direction.LONG else "BUY"
        self._place_market_order(position.pair, side, position.size)

        if position.direction == Direction.LONG:
            pnl = (close_price - position.fill_price) * position.size
        else:
            pnl = (position.fill_price - close_price) * position.size

        position.realized_pnl = pnl
        position.closed_at = datetime.now(tz=timezone.utc)
        return pnl

    def update_stop(self, position: Position, new_stop: float) -> None:
        logger.info("live stop update not auto-placed — manual OCO replacement required for %s", position.pair)
        position.stop_price = new_stop
