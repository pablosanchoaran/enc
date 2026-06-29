"""SQLite persistence layer for OHLCV candles and positions."""

import pandas as pd
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer, String,
    create_engine, text,
)
from sqlalchemy.orm import DeclarativeBase, Session

from cryptobot.config.settings import get_settings


class Base(DeclarativeBase):
    pass


class CandleRow(Base):
    __tablename__ = "candles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    pair = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False)
    interpolated = Column(Boolean, default=False)


class DataStore:
    def __init__(self, database_url: str | None = None):
        url = database_url or get_settings().database_url
        self.engine = create_engine(url, echo=False)
        Base.metadata.create_all(self.engine)

    def upsert_candles(self, df: pd.DataFrame, pair: str, timeframe: str) -> int:
        """Insert candles, skipping duplicates by (pair, timeframe, timestamp)."""
        with Session(self.engine) as session:
            inserted = 0
            for _, row in df.iterrows():
                exists = session.execute(
                    text(
                        "SELECT 1 FROM candles WHERE pair=:p AND timeframe=:t AND timestamp=:ts"
                    ),
                    {"p": pair, "t": timeframe, "ts": row["timestamp"]},
                ).fetchone()
                if not exists:
                    session.add(
                        CandleRow(
                            timestamp=row["timestamp"],
                            open=row["open"],
                            high=row["high"],
                            low=row["low"],
                            close=row["close"],
                            volume=row["volume"],
                            pair=pair,
                            timeframe=timeframe,
                            interpolated=row.get("interpolated", False),
                        )
                    )
                    inserted += 1
            session.commit()
        return inserted

    def load_candles(
        self,
        pair: str,
        timeframe: str,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
    ) -> pd.DataFrame:
        query = "SELECT * FROM candles WHERE pair=:p AND timeframe=:t"
        params: dict = {"p": pair, "t": timeframe}
        if from_dt:
            query += " AND timestamp >= :from_dt"
            params["from_dt"] = from_dt
        if to_dt:
            query += " AND timestamp <= :to_dt"
            params["to_dt"] = to_dt
        query += " ORDER BY timestamp ASC"
        with Session(self.engine) as session:
            result = session.execute(text(query), params).fetchall()
        if not result:
            return pd.DataFrame(
                columns=["timestamp", "open", "high", "low", "close", "volume", "pair", "timeframe", "interpolated"]
            )
        df = pd.DataFrame(result, columns=result[0]._fields)
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        return df.set_index("timestamp").drop(columns=["id"])
