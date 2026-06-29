#!/usr/bin/env python3
"""Download historical OHLCV data for all configured pairs and store locally."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cryptobot.config.settings import get_settings
from cryptobot.data.fetcher import BinanceFetcher
from cryptobot.data.store import DataStore
from cryptobot.monitoring.logger import configure_logging

configure_logging()

settings = get_settings()
fetcher = BinanceFetcher()
store = DataStore()

DAYS = 365

for pair in settings.trading_pairs:
    from_dt = datetime.now(tz=timezone.utc) - timedelta(days=DAYS)
    print(f"Fetching {DAYS}d of {pair} {settings.timeframe}...")
    df = fetcher.fetch_historical(pair, settings.timeframe, from_dt)
    inserted = store.upsert_candles(df, pair, settings.timeframe)
    print(f"  → Stored {inserted} new candles for {pair}")

print("Done.")
