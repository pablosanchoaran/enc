Feature: Risk Management and Position Sizing
  As the risk engine
  I need to enforce position size limits and portfolio-level protections
  So that no single trade or sequence of losses can cause ruin

  Background:
    Given total portfolio capital is 5000.0 EUR
    And the risk-per-trade parameter is 1.0 percent of capital
    And the maximum open positions is 3
    And the daily drawdown circuit breaker is 3.0 percent

  Scenario: Position size calculation from ATR-based stop distance
    Given the entry price for "BTCUSDT" is 65000.0
    And the stop-loss price is 63700.0
    And the stop distance is 1300.0 (2.0% of entry)
    When the position sizer calculates trade size
    Then the maximum loss if stopped out is 50.0 EUR (1% of 5000)
    And the position size in USDT is 2500.0
    And the position size does not exceed 30% of total capital

  Scenario: Position size grows with compounding after profitable day
    Given the portfolio balance at start of day is 5100.0 EUR after yesterday's profit
    And the entry price is 65000.0
    And the stop-loss price is 63700.0
    When the position sizer calculates trade size
    Then the maximum loss if stopped out is 51.0 EUR (1% of 5100)
    And the position value is proportionally larger than yesterday

  Scenario: Position blocked when max open positions reached
    Given there are already 3 open positions across the portfolio
    When a new signal is generated for any pair
    Then the execution engine rejects the signal
    And logs a WARNING "Max open positions (3) reached — signal rejected"

  Scenario: Daily circuit breaker halts trading
    Given trading started at 00:00 UTC with capital 5000.0
    And the bot has incurred 152.0 EUR in losses today (3.04% drawdown)
    When the risk manager evaluates the next signal
    Then trading is suspended for the remainder of the UTC day
    And a Telegram alert is sent containing "Circuit breaker triggered"
    And all open stop-loss orders remain active

  Scenario: Correlated position limit across BTC and ETH
    Given there is an open LONG position on "BTCUSDT"
    And the 30-day correlation between BTCUSDT and ETHUSDT is above 0.85
    When an ETHUSDT LONG signal is generated
    Then the position size for ETHUSDT is reduced by 50%
    And a log message records "Correlation reduction applied"

  Scenario: Stop-loss tightened to breakeven after price moves in favor
    Given a LONG position on "SOLUSDT" with entry at 150.0
    And the initial stop-loss is at 143.0
    And the price has moved to 157.0 (entry plus 1x ATR distance)
    When the trailing stop engine evaluates the position
    Then the stop-loss is moved up to at least 150.0 (breakeven)
    And no action reduces the stop-loss below its current level

  Scenario: Trailing stop follows EMA-21 upward in trending regime
    Given a LONG position on "BTCUSDT" with stop already at breakeven
    And EMA-21 is at 66000.0 which is above the current stop of 65000.0
    When the trailing stop engine evaluates the position
    Then the stop-loss is updated to 66000.0
    And the update is logged with previous and new stop prices

  Scenario: Trading paused when balance falls below minimum
    Given the portfolio balance falls to 1950.0 EUR
    When the portfolio monitor runs its periodic check
    Then new signal generation is suspended
    And a CRITICAL Telegram alert is sent about the low balance
