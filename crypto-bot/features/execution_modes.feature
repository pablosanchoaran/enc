Feature: Paper and Live Execution Modes
  As a trader
  I need to run the bot in paper mode before live mode
  So that I can validate strategy performance without real capital at risk

  Background:
    Given the system configuration specifies the execution mode
    And the Binance API client is initialized

  Scenario: Paper mode executes orders without hitting the exchange
    Given execution mode is "PAPER"
    And a LONG signal is generated for "BTCUSDT" with entry at 65000.0 and size 0.038
    When the paper executor processes the signal
    Then no order is sent to the Binance API
    And an internal position record is created with status "OPEN"
    And the fill price is simulated as entry price plus 0.05% slippage
    And the portfolio cash balance is reduced by the position value plus slippage

  Scenario: Paper mode tracks unrealized P&L accurately
    Given an open paper position: LONG "ETHUSDT", entry 3500.0, size 0.714 ETH
    When the current market price updates to 3640.0
    Then unrealized P&L is approximately 100.0 EUR
    And the portfolio dashboard shows total value as initial_capital plus unrealized PnL

  Scenario: Paper mode triggers stop-loss on price breach
    Given an open paper position: SHORT "SOLUSDT", entry 160.0, stop-loss 168.0
    When a candle closes with high of 170.0
    Then the position is closed at the stop-loss price of 168.0
    And a realized loss is recorded
    And the position status changes to "CLOSED_STOP"

  Scenario: Paper mode triggers take-profit on price target reached
    Given an open paper position: LONG "BTCUSDT", entry 65000.0, take-profit 67000.0
    When a candle closes with high of 67500.0
    Then the position is closed at the take-profit price of 67000.0
    And a realized profit is recorded
    And the position status changes to "CLOSED_TP"

  Scenario: Live mode sends actual orders to Binance
    Given execution mode is "LIVE"
    And the Binance API keys have SPOT trading permission
    And a LONG signal is generated for "BTCUSDT" with size 0.038 BTC
    When the live executor processes the signal
    Then a MARKET BUY order is placed on Binance for 0.038 BTC
    And the stop-loss and take-profit are placed as an OCO order
    And the order IDs are stored in the position record

  Scenario: Live executor retries on transient API error
    Given execution mode is "LIVE"
    And the Binance API returns a 503 error on the first order attempt
    When the live executor processes the signal
    Then the executor retries up to 3 times with exponential backoff
    And if successful the position is recorded normally
    And if all retries fail a CRITICAL alert is sent via Telegram

  Scenario: Mode transition gate — paper to live requires passing all criteria
    Given the bot has run in paper mode for 31 calendar days
    And total paper trades executed is 75
    And paper mode Sharpe ratio over 30 days is 1.2
    And paper mode maximum drawdown is 6%
    When the operator runs "cryptobot go-live --confirm"
    Then the system prints a table showing all 4 gate criteria as PASS
    And asks for explicit typed confirmation before switching mode

  Scenario: Mode transition blocked when gate criteria not met
    Given the bot has run in paper mode for 20 calendar days
    And Sharpe ratio is 0.7
    When the operator runs "cryptobot go-live --confirm"
    Then the system prints G-01 duration as FAIL (20 days < 30)
    And prints G-03 Sharpe as FAIL (0.7 < 1.0)
    And does not allow mode switching
    And exits with a non-zero status code

  Scenario: Strategy code is agnostic to execution mode
    Given the AMMR strategy module is loaded
    When inspecting its imports and dependencies
    Then it does not import paper_executor or live_executor
    And it only depends on the abstract base_executor interface
