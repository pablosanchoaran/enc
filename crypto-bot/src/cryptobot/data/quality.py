"""Data quality checks and gap filling for OHLCV DataFrames."""

from datetime import timezone

import numpy as np
import pandas as pd

TIMEFRAME_MINUTES = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
}


def fill_gaps(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    """Detect timestamp gaps, interpolate missing candles, and mark them."""
    if df.empty:
        return df

    freq_minutes = TIMEFRAME_MINUTES.get(timeframe)
    if not freq_minutes:
        return df

    df = df.copy().sort_values("timestamp")
    freq = pd.Timedelta(minutes=freq_minutes)

    ts_col = df["timestamp"]
    expected = pd.date_range(
        start=ts_col.iloc[0],
        end=ts_col.iloc[-1],
        freq=freq,
        tz="UTC",
    )

    missing = expected.difference(pd.DatetimeIndex(ts_col))
    if len(missing) == 0:
        return df

    gap_rows = []
    for ts in missing:
        gap_rows.append(
            {
                "timestamp": ts,
                "open": np.nan,
                "high": np.nan,
                "low": np.nan,
                "close": np.nan,
                "volume": 0.0,
                "pair": df["pair"].iloc[0],
                "timeframe": timeframe,
                "interpolated": True,
            }
        )

    df_gaps = pd.DataFrame(gap_rows)
    df_combined = pd.concat([df, df_gaps], ignore_index=True).sort_values("timestamp")

    for col in ["open", "high", "low", "close"]:
        df_combined[col] = df_combined[col].interpolate(method="linear")

    return df_combined.reset_index(drop=True)


def check_quality(df: pd.DataFrame) -> dict:
    """Return a dict with quality stats: missing count, ohlc violations, nulls."""
    result = {
        "total_rows": len(df),
        "interpolated_count": int(df.get("interpolated", pd.Series([False] * len(df))).sum()),
        "null_count": int(df[["open", "high", "low", "close", "volume"]].isnull().sum().sum()),
        "ohlc_violations": 0,
    }
    ohlc_ok = (df["low"] <= df["open"]) & (df["low"] <= df["close"]) & \
               (df["high"] >= df["open"]) & (df["high"] >= df["close"])
    result["ohlc_violations"] = int((~ohlc_ok).sum())
    return result
