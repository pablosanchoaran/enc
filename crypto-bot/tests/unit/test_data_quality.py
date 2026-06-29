"""Unit tests for data quality checks and gap filling."""

import pandas as pd
import pytest
from datetime import datetime, timezone, timedelta

from cryptobot.data.quality import check_quality, fill_gaps


def make_ohlcv(timestamps, pair="ETHUSDT", timeframe="1h"):
    rows = []
    for ts in timestamps:
        rows.append({
            "timestamp": ts,
            "open": 100.0, "high": 110.0, "low": 90.0, "close": 105.0,
            "volume": 1000.0, "pair": pair, "timeframe": timeframe, "interpolated": False,
        })
    return pd.DataFrame(rows)


def hourly_range(n, start=None):
    if start is None:
        start = datetime(2024, 3, 15, 0, 0, tzinfo=timezone.utc)
    return [start + timedelta(hours=i) for i in range(n)]


def test_fill_gaps_no_gaps():
    timestamps = hourly_range(10)
    df = make_ohlcv(timestamps)
    result = fill_gaps(df, "1h")
    assert len(result) == 10
    assert result["interpolated"].sum() == 0


def test_fill_gaps_detects_3_hour_gap():
    timestamps = hourly_range(5) + hourly_range(5, start=datetime(2024, 3, 15, 8, 0, tzinfo=timezone.utc))
    df = make_ohlcv(timestamps)
    result = fill_gaps(df, "1h")
    assert result["interpolated"].sum() == 3


def test_fill_gaps_marks_interpolated_true():
    timestamps = hourly_range(4) + hourly_range(4, start=datetime(2024, 3, 15, 6, 0, tzinfo=timezone.utc))
    df = make_ohlcv(timestamps)
    result = fill_gaps(df, "1h")
    interpolated = result[result["interpolated"] == True]
    assert len(interpolated) == 2


def test_fill_gaps_preserves_original_data():
    timestamps = hourly_range(5)
    df = make_ohlcv(timestamps)
    result = fill_gaps(df, "1h")
    originals = result[result["interpolated"] == False]
    assert len(originals) == 5


def test_check_quality_clean_data():
    timestamps = hourly_range(24)
    df = make_ohlcv(timestamps)
    report = check_quality(df)
    assert report["null_count"] == 0
    assert report["ohlc_violations"] == 0
    assert report["total_rows"] == 24


def test_check_quality_detects_ohlc_violation():
    timestamps = hourly_range(3)
    df = make_ohlcv(timestamps)
    df.loc[1, "close"] = 200.0  # close > high → violation
    report = check_quality(df)
    assert report["ohlc_violations"] >= 1
