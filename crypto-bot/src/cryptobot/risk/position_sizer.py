"""Position sizer — 1% risk per trade on current portfolio balance (compounding)."""

from cryptobot.config.constants import MAX_POSITION_PCT, RISK_PER_TRADE
from cryptobot.data.schemas import Direction, Signal


def calculate_size(
    signal: Signal,
    portfolio_balance: float,
    risk_pct: float = RISK_PER_TRADE,
    max_position_pct: float = MAX_POSITION_PCT,
) -> float:
    """Return position size in base asset units.

    Args:
        signal: The trading signal with entry and stop prices.
        portfolio_balance: Current total portfolio value in EUR (updated daily for compounding).
        risk_pct: Fraction of balance to risk per trade (default 1%).
        max_position_pct: Max fraction of balance in a single position (default 30%).

    Returns:
        Position size in base asset units (e.g., BTC amount).
    """
    risk_amount = portfolio_balance * risk_pct
    stop_distance = abs(signal.entry_price - signal.stop_price)

    if stop_distance <= 0:
        raise ValueError(f"stop_distance must be > 0, got {stop_distance}")

    size_by_risk = risk_amount / stop_distance
    max_size = (portfolio_balance * max_position_pct) / signal.entry_price

    return min(size_by_risk, max_size)


def risk_amount(portfolio_balance: float, risk_pct: float = RISK_PER_TRADE) -> float:
    """Return the EUR amount at risk for the given balance."""
    return portfolio_balance * risk_pct
