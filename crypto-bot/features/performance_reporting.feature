Feature: Backtest and Live Performance Reporting
  As a trader
  I need accurate performance metrics and timely alerts
  So that I can evaluate strategy viability before and during live trading

  Scenario: Backtest produces all required metrics
    Given a backtest run on "BTCUSDT" 1H data from 2023-01-01 to 2024-01-01
    And initial capital is 5000.0 EUR
    When the backtest engine finishes
    Then the report includes total_return_pct and annualized_return_pct
    And the report includes sharpe_ratio, sortino_ratio, and calmar_ratio
    And the report includes max_drawdown_pct and max_drawdown_duration_days
    And the report includes win_rate, profit_factor, avg_winner_pct, avg_loser_pct
    And the report includes total_trades and trades_per_day
    And all metrics are written to a JSON file in data/backtest_results/

  Scenario: Backtest meets minimum quality gate for Phase 3
    Given a backtest run on 2023 BTCUSDT/ETHUSDT/SOLUSDT 1H data
    And initial capital is 5000.0 EUR
    When the backtest engine finishes with optimized AMMR parameters
    Then sharpe_ratio is greater than or equal to 0.8
    And max_drawdown_pct is less than 15.0
    And win_rate is greater than or equal to 50.0
    And profit_factor is greater than or equal to 1.3

  Scenario: Daily summary report sent via Telegram at midnight UTC
    Given the bot has been running in paper or live mode for a full UTC day
    When 00:00 UTC is reached
    Then a Telegram message is sent with trades count for the day
    And the message includes realized PnL for the day
    And the message includes count of open positions
    And the message includes current drawdown from peak
    And the message includes remaining daily loss budget before circuit breaker

  Scenario: Trade alert sent immediately on execution
    Given execution mode is "PAPER" or "LIVE"
    And a position is opened on "ETHUSDT"
    When the executor confirms the fill
    Then a Telegram alert is sent within 5 seconds
    And the alert contains pair, direction, fill price, and position size

  Scenario: Trade closed alert sent on stop or take-profit
    Given an open position on "SOLUSDT" is closed by stop-loss
    When the executor confirms the closure
    Then a Telegram alert is sent with realized PnL
    And the alert specifies the closure reason as "STOP_LOSS"

  Scenario: Backtest report written to disk
    Given a completed backtest run with run_id "bt_test_001"
    When the report generator runs
    Then a file exists at "data/backtest_results/bt_test_001.json"
    And the JSON contains all required metric fields from the schema
    And a human-readable HTML summary is also written to the same directory
