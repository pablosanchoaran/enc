"""Event-driven backtest engine.

Processes OHLCV data candle by candle. Strategy and risk code are identical
to paper/live modes. Only the executor (PaperExecutor) differs.
"""

import logging
from dataclasses import dataclass
from datetime import datetime

import pandas as pd

from cryptobot.backtest.metrics import BacktestMetrics, compute_metrics
from cryptobot.config.constants import BINANCE_FEE, PAPER_SLIPPAGE
from cryptobot.data.schemas import Direction, Position, PositionStatus, Signal
from cryptobot.execution.paper_executor import PaperExecutor
from cryptobot.risk.portfolio import PortfolioRiskManager, PortfolioState
from cryptobot.risk.position_sizer import calculate_size
from cryptobot.risk.stop_loss import update_trailing_stop
from cryptobot.strategy.ammr import AMMRStrategy

logger = logging.getLogger(__name__)

WARMUP_CANDLES = 50


@dataclass
class BacktestConfig:
    pair: str
    timeframe: str
    initial_capital: float
    from_dt: datetime | None = None
    to_dt: datetime | None = None


class BacktestEngine:
    def __init__(self, config: BacktestConfig):
        self.config = config
        self.strategy = AMMRStrategy()
        self.executor = PaperExecutor()
        self.state = PortfolioState(
            balance=config.initial_capital,
            day_start_balance=config.initial_capital,
        )
        self.risk = PortfolioRiskManager(self.state)
        self.closed_positions: list[Position] = []

    def run(self, df: pd.DataFrame) -> BacktestMetrics:
        df = df.reset_index()
        if "timestamp" not in df.columns:
            df = df.rename(columns={df.columns[0]: "timestamp"})

        n = len(df)
        logger.info("backtest start pair=%s candles=%d capital=%.2f", self.config.pair, n, self.config.initial_capital)

        current_day = None

        for i in range(WARMUP_CANDLES, n):
            window = df.iloc[: i + 1].copy()
            row = window.iloc[-1]
            candle_dt = pd.Timestamp(row["timestamp"])

            # Daily reset for compounding
            if current_day != candle_dt.date():
                current_day = candle_dt.date()
                self.state.reset_day(self.state.balance)

            # Evaluate open positions for stop/TP on this candle
            self._evaluate_open_positions(row)

            # Generate new signal
            open_pairs = self.state.open_pairs()
            signal = self.strategy.generate_signal(window, self.config.pair, open_pairs)
            if signal is None:
                continue

            allowed, reason = self.risk.can_open_position(signal)
            if not allowed:
                logger.debug("signal rejected: %s", reason)
                continue

            size = calculate_size(signal, self.state.balance)
            position = self.executor.open_position(signal, size)
            # Only deduct fee (balance = total equity; position cost is a conversion, not a loss)
            fee_cost = position.fill_price * position.size * BINANCE_FEE
            self.risk.record_fill(position, fee_cost)

        # Close any remaining open positions at last price
        last_price = df["close"].iloc[-1]
        for pos in list(self.state.open_positions):
            if pos.status == PositionStatus.OPEN:
                pnl = self.executor.close_position(pos, last_price, "MANUAL")
                self.closed_positions.append(pos)
                self.risk.record_close(pos, pnl)

        trading_days = (df["timestamp"].iloc[-1] - df["timestamp"].iloc[0]).days or 1
        metrics = compute_metrics(
            self.closed_positions,
            self.config.initial_capital,
            trading_days,
        )
        logger.info(
            "backtest done trades=%d sharpe=%.3f dd=%.2f%% return=%.2f%%",
            metrics.total_trades, metrics.sharpe_ratio,
            metrics.max_drawdown_pct, metrics.total_return_pct,
        )
        return metrics

    def _evaluate_open_positions(self, row: pd.Series) -> None:
        high = row["high"]
        low = row["low"]

        for pos in list(self.state.open_positions):
            if pos.status != PositionStatus.OPEN:
                continue

            hit_stop = (pos.direction == Direction.LONG and low <= pos.stop_price) or \
                       (pos.direction == Direction.SHORT and high >= pos.stop_price)
            hit_tp = (pos.direction == Direction.LONG and high >= pos.take_profit_price) or \
                     (pos.direction == Direction.SHORT and low <= pos.take_profit_price)

            if hit_stop:
                pnl = self.executor.close_position(pos, pos.stop_price, "STOP")
                self.closed_positions.append(pos)
                self.risk.record_close(pos, pnl)
            elif hit_tp:
                pnl = self.executor.close_position(pos, pos.take_profit_price, "TP")
                self.closed_positions.append(pos)
                self.risk.record_close(pos, pnl)
