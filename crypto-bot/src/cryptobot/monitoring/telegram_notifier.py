"""Telegram alert and daily summary notifications."""

import asyncio
import logging

from cryptobot.config.settings import get_settings
from cryptobot.data.schemas import Position

logger = logging.getLogger(__name__)


class TelegramNotifier:
    def __init__(self, token: str | None = None, chat_id: str | None = None):
        settings = get_settings()
        self._token = token or settings.telegram_bot_token
        self._chat_id = chat_id or settings.telegram_chat_id

    def _enabled(self) -> bool:
        return bool(self._token and self._chat_id)

    async def _send(self, text: str) -> None:
        if not self._enabled():
            logger.debug("telegram not configured — skipping alert")
            return
        try:
            from telegram import Bot
            bot = Bot(token=self._token)
            await bot.send_message(chat_id=self._chat_id, text=text, parse_mode="Markdown")
        except Exception as e:
            logger.error("telegram send failed: %s", e)

    def send(self, text: str) -> None:
        asyncio.run(self._send(text))

    def trade_opened(self, position: Position) -> None:
        msg = (
            f"*Trade abierto* {position.pair}\n"
            f"Dirección: {position.direction}\n"
            f"Fill: {position.fill_price:.4f}\n"
            f"Tamaño: {position.size:.6f}\n"
            f"Stop: {position.stop_price:.4f}\n"
            f"TP: {position.take_profit_price:.4f}"
        )
        self.send(msg)

    def trade_closed(self, position: Position) -> None:
        emoji = "✅" if position.realized_pnl > 0 else "❌"
        msg = (
            f"{emoji} *Trade cerrado* {position.pair}\n"
            f"P&L: {position.realized_pnl:+.2f}€\n"
            f"Motivo: {position.status.value}"
        )
        self.send(msg)

    def circuit_breaker(self, daily_dd_pct: float) -> None:
        msg = f"⛔ *Circuit breaker triggered*\nPérdida diaria: {daily_dd_pct:.2f}%\nTrading suspendido hasta 00:00 UTC"
        self.send(msg)

    def daily_summary(
        self,
        trades_today: int,
        pnl_today: float,
        open_positions: int,
        drawdown_pct: float,
        remaining_budget: float,
    ) -> None:
        sign = "+" if pnl_today >= 0 else ""
        msg = (
            f"📊 *Resumen diario*\n"
            f"Trades: {trades_today}\n"
            f"P&L hoy: {sign}{pnl_today:.2f}€\n"
            f"Posiciones abiertas: {open_positions}\n"
            f"Drawdown: {drawdown_pct:.2f}%\n"
            f"Presupuesto restante: {remaining_budget:.2f}€"
        )
        self.send(msg)

    def low_balance_alert(self, balance: float) -> None:
        msg = f"⚠️ *Balance crítico*: {balance:.2f}€\nTrading pausado automáticamente"
        self.send(msg)
