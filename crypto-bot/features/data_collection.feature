Feature: Historical and Live Data Collection
  As a trading bot
  I need reliable OHLCV data for BTC, ETH, and SOL
  So that indicators can be computed accurately

  Background:
    Given the Binance API client is configured
    And the target trading pairs are ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

  Scenario: Fetch historical OHLCV data for backtesting
    Given I request 365 days of 1-hour OHLCV data for "BTCUSDT"
    When the historical fetcher runs
    Then I receive a DataFrame with columns ["timestamp", "open", "high", "low", "close", "volume"]
    And the DataFrame has no missing timestamps in the expected range
    And all OHLC values are positive floats
    And close price is between low and high for every row

  Scenario: Detect and handle data gaps
    Given a stored OHLCV dataset for "ETHUSDT" with a 3-hour gap at "2024-03-15 02:00"
    When the data quality checker runs
    Then it reports exactly 3 missing candles
    And it back-fills the gap using linear interpolation
    And it flags those candles with an "interpolated" boolean column set to True

  Scenario: Stream live candle data via WebSocket
    Given the WebSocket feed is subscribed to "SOLUSDT" 1h kline stream
    When a new closed candle is received
    Then the candle is stored in the local database within 100ms
    And the indicator engine is notified of the new candle
    And the previous candle's data is not modified

  Scenario: Reconnect after WebSocket disconnection
    Given the WebSocket feed for "BTCUSDT" drops unexpectedly
    When 5 seconds have elapsed
    Then the client automatically reconnects
    And any missed closed candles since disconnection are fetched via REST API
    And the system logs a WARNING event with the disconnection duration
