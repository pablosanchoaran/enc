"""
Generador de datos OHLCV sintéticos con modelo de régimen cambiante.

Simula comportamiento realista de BTC:
- Régimen TRENDING: movimiento direccional fuerte (GBM con drift alto)
- Régimen RANGING: movimiento lateral (mean-reverting alrededor de precio central)
- Markov chain entre regímenes
- Parámetros calibrados en BTC 2020-2024 (vol ~0.25%/hora, regímenes de días-semanas)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta


# Parámetros calibrados en BTC histórico
HOURLY_VOL_TRENDING = 0.0040    # 0.40%/hora en tendencia (BTC real ~0.3-0.5%)
HOURLY_VOL_RANGING  = 0.0020    # 0.20%/hora en rango (BTC sideways)
HOURLY_DRIFT_TREND  = 0.0006    # 0.06%/hora de drift → tendencias visibles de días
MEAN_REVERSION_SPEED = 0.012    # Reversión más fuerte → RSI entra en zona

# Probabilidades de transición por vela (1H)
# Tendencia media: 1/0.006 = 167h ≈ 7 días
# Rango medio:    1/0.008 = 125h ≈ 5 días
P_TREND_TO_RANGE = 0.006
P_RANGE_TO_TREND = 0.008

CANDLE_SPREAD_PCT  = 0.004      # Spread high-low realista (high-low ~0.4% del close)


def generate_ohlcv(
    n_candles: int = 8760,       # 1 año
    initial_price: float = 50000.0,
    pair: str = "BTCUSDT",
    timeframe: str = "1h",
    seed: int = 42,
    initial_regime: str = "RANGING",
) -> pd.DataFrame:
    """Genera n_candles velas OHLCV con régimen cambiante tipo BTC."""
    rng = np.random.default_rng(seed)

    prices = np.zeros(n_candles)
    regimes = []
    prices[0] = initial_price
    regime = initial_regime
    trend_direction = 1  # +1 up, -1 down
    center = initial_price  # mean-reversion center, set when entering RANGING

    for i in range(1, n_candles):
        # Transición de régimen (Markov)
        if regime == "TRENDING":
            if rng.random() < P_TREND_TO_RANGE:
                regime = "RANGING"
                center = prices[i - 1]
        else:
            if rng.random() < P_RANGE_TO_TREND:
                regime = "TRENDING"
                trend_direction = rng.choice([-1, 1])

        regimes.append(regime)

        if regime == "TRENDING":
            log_return = trend_direction * HOURLY_DRIFT_TREND + rng.normal(0, HOURLY_VOL_TRENDING)
        else:
            mean_return = MEAN_REVERSION_SPEED * (np.log(center) - np.log(prices[i - 1]))
            log_return = mean_return + rng.normal(0, HOURLY_VOL_RANGING)

        prices[i] = prices[i - 1] * np.exp(log_return)

    regimes.append(regime)

    # Construir OHLCV realista
    start = datetime(2023, 1, 1, tzinfo=timezone.utc)
    rows = []
    for i in range(n_candles):
        close = prices[i]
        spread = close * CANDLE_SPREAD_PCT
        high = close + rng.uniform(0, spread)
        low = close - rng.uniform(0, spread)
        open_ = prices[i - 1] if i > 0 else close

        # Asegurar OHLC válido
        high = max(high, open_, close)
        low = min(low, open_, close)

        rows.append({
            "timestamp": start + timedelta(hours=i),
            "open": round(open_, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": round(rng.uniform(100, 2000), 2),
            "pair": pair,
            "timeframe": timeframe,
            "interpolated": False,
            "_regime": regimes[i],
        })

    df = pd.DataFrame(rows)
    return df


def regime_stats(df: pd.DataFrame) -> dict:
    counts = df["_regime"].value_counts()
    total = len(df)
    return {
        "trending_pct": round(counts.get("TRENDING", 0) / total * 100, 1),
        "ranging_pct": round(counts.get("RANGING", 0) / total * 100, 1),
        "price_start": df["close"].iloc[0],
        "price_end": df["close"].iloc[-1],
        "total_return_pct": round((df["close"].iloc[-1] / df["close"].iloc[0] - 1) * 100, 1),
        "max_price": df["high"].max(),
        "min_price": df["low"].min(),
    }


if __name__ == "__main__":
    df = generate_ohlcv()
    stats = regime_stats(df)
    print(f"Generated {len(df)} candles")
    print(f"  Price: {stats['price_start']:.0f} → {stats['price_end']:.0f} ({stats['total_return_pct']:+.1f}%)")
    print(f"  Trending: {stats['trending_pct']}%  Ranging: {stats['ranging_pct']}%")
