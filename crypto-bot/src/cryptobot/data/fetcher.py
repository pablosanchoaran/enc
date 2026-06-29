"""Binance REST historical fetcher and WebSocket live feed."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable

import pandas as pd
from binance.client import Client
from binance.websockets import BinanceSocketManager

from cryptobot.config.constants import WEBSOCKET_RECONNECT_DELAY_S
from cryptobot.config.settings import get_settings
from cryptobot.data.quality import fill_gaps

logger = logging.getLogger(__name__)

INTERVAL_MAP = {
    "1m": Client.KLINE_INTERVAL_1MINUTE,
    "5m": Client.KLINE_INTERVAL_5MINUTE,
    "15m": Client.KLINE_INTERVAL_15MINUTE,
    "1h": Client.KLINE_INTERVAL_1HOUR,
    "4h": Client.KLINE_INTERVAL_4HOUR,
    "1d": Client.KLINE_INTERVAL_1DAY,
}


def _raw_to_df(raw_klines: list, pair: str, timeframe: str) -> pd.DataFrame:
    df = pd.DataFrame(
        raw_klines,
        columns=[
            "timestamp", "open", "high", "low", "close", "volume",
            "close_time", "quote_volume", "trade_count",
            "taker_buy_base", "taker_buy_quote", "ignore",
        ],
    )
    df["timestamp"] = pd.to_datetime(df["timestamp"].astype("int64"), unit="ms", utc=True)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].astype(float)
    df["pair"] = pair
    df["timeframe"] = timeframe
    df["interpolated"] = False
    return df[["timestamp", "open", "high", "low", "close", "volume", "pair", "timeframe", "interpolated"]]


class BinanceFetcher:
    def __init__(self, api_key: str | None = None, secret_key: str | None = None):
        settings = get_settings()
        self._client = Client(
            api_key=api_key or settings.binance_api_key,
            api_secret=secret_key or settings.binance_secret_key,
        )

    def fetch_historical(
        self,
        pair: str,
        timeframe: str,
        from_dt: datetime,
        to_dt: datetime | None = None,
    ) -> pd.DataFrame:
        interval = INTERVAL_MAP.get(timeframe)
        if not interval:
            raise ValueError(f"Unsupported timeframe: {timeframe}")

        start_str = str(int(from_dt.timestamp() * 1000))
        end_str = str(int(to_dt.timestamp() * 1000)) if to_dt else None

        raw = self._client.get_historical_klines(pair, interval, start_str, end_str)
        if not raw:
            return pd.DataFrame()

        df = _raw_to_df(raw, pair, timeframe)
        df = fill_gaps(df, timeframe)
        logger.info("fetched %d candles for %s %s", len(df), pair, timeframe)
        return df

    def fetch_since(self, pair: str, timeframe: str, since_dt: datetime) -> pd.DataFrame:
        """Fetch candles since a given datetime — used for gap recovery after WS outage."""
        return self.fetch_historical(pair, timeframe, since_dt)


class LiveFeed:
    """Subscribes to Binance WebSocket kline streams and calls back on closed candles."""

    def __init__(
        self,
        pairs: list[str],
        timeframe: str,
        on_candle: Callable[[pd.Series], None],
        api_key: str | None = None,
        secret_key: str | None = None,
    ):
        settings = get_settings()
        self._client = Client(
            api_key=api_key or settings.binance_api_key,
            api_secret=secret_key or settings.binance_secret_key,
        )
        self._pairs = pairs
        self._timeframe = timeframe
        self._on_candle = on_candle
        self._last_candle_time: dict[str, datetime] = {}
        self._bm: BinanceSocketManager | None = None

    def _handle_message(self, msg: dict) -> None:
        if msg.get("e") == "error":
            logger.warning("websocket error: %s", msg)
            return
        kline = msg.get("k", {})
        if not kline.get("x"):
            return
        pair = kline["s"]
        candle = pd.Series(
            {
                "timestamp": pd.Timestamp(kline["t"], unit="ms", tz="UTC"),
                "open": float(kline["o"]),
                "high": float(kline["h"]),
                "low": float(kline["l"]),
                "close": float(kline["c"]),
                "volume": float(kline["v"]),
                "pair": pair,
                "timeframe": self._timeframe,
                "interpolated": False,
            }
        )
        self._last_candle_time[pair] = candle["timestamp"].to_pydatetime()
        self._on_candle(candle)

    def start(self) -> None:
        self._bm = BinanceSocketManager(self._client)
        streams = [
            f"{pair.lower()}@kline_{self._timeframe}" for pair in self._pairs
        ]
        self._conn_key = self._bm.start_multiplex_socket(streams, self._handle_message)
        self._bm.start()
        logger.info("live feed started for pairs: %s timeframe: %s", self._pairs, self._timeframe)

    def stop(self) -> None:
        if self._bm:
            self._bm.stop_socket(self._conn_key)
            self._bm.close()
