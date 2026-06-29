from enum import Enum
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ExecutionMode(str, Enum):
    BACKTEST = "BACKTEST"
    PAPER = "PAPER"
    LIVE = "LIVE"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    binance_api_key: str = Field(default="", alias="BINANCE_API_KEY")
    binance_secret_key: str = Field(default="", alias="BINANCE_SECRET_KEY")

    telegram_bot_token: str = Field(default="", alias="TELEGRAM_BOT_TOKEN")
    telegram_chat_id: str = Field(default="", alias="TELEGRAM_CHAT_ID")

    execution_mode: ExecutionMode = Field(default=ExecutionMode.PAPER, alias="EXECUTION_MODE")

    initial_capital: float = Field(default=5000.0, alias="INITIAL_CAPITAL", gt=0)
    database_url: str = Field(default="sqlite:///./data/cryptobot.db", alias="DATABASE_URL")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    trading_pairs: list[str] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
    timeframe: str = "1h"


def get_settings() -> Settings:
    return Settings()
