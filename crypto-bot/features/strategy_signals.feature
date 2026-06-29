Feature: AMMR Strategy Signal Generation
  As the strategy engine
  I need to classify market regime and generate trading signals
  So that trades are aligned with current market conditions

  Background:
    Given indicator values are computed from a valid 200-candle OHLCV window
    And the regime classifier uses ADX period 14, trending threshold 25, ranging threshold 20

  Scenario Outline: Regime classification based on ADX value
    Given ADX is <adx_value>
    When the regime detector runs
    Then the detected regime is "<expected_regime>"

    Examples:
      | adx_value | expected_regime |
      | 30        | TRENDING        |
      | 22        | TRANSITION      |
      | 15        | RANGING         |
      | 25.0      | TRENDING        |
      | 20.0      | RANGING         |

  Scenario: Generate long entry signal in trending regime
    Given the market regime is TRENDING
    And EMA-8 is above EMA-21
    And the current close price is above the 20-period rolling high
    And RSI-14 is between 45 and 70
    When the momentum strategy evaluates the current candle
    Then a LONG signal is generated
    And the signal includes an entry price at market
    And the signal includes an initial stop-loss at EMA-21 minus one ATR
    And the signal includes a take-profit at entry plus 2x the stop distance

  Scenario: Generate short entry signal in trending regime
    Given the market regime is TRENDING
    And EMA-8 is below EMA-21
    And the current close price is below the 20-period rolling low
    And RSI-14 is between 30 and 55
    When the momentum strategy evaluates the current candle
    Then a SHORT signal is generated
    And the signal includes an initial stop-loss at EMA-21 plus one ATR
    And the signal includes a take-profit at entry minus 2x the stop distance

  Scenario: No signal in transition regime
    Given the market regime is TRANSITION
    When the AMMR strategy evaluates the current candle
    Then no new signal is generated
    And any logged output states "Regime TRANSITION — skipping signal"

  Scenario: Generate long signal in ranging regime
    Given the market regime is RANGING
    And the close price has touched or crossed below the lower Bollinger Band (20, 2.0)
    And RSI-14 is below 35
    When the mean reversion strategy evaluates the current candle
    Then a LONG signal is generated
    And the target price is the Bollinger Band midline
    And the stop-loss is set at lower band minus 0.5x band width

  Scenario: Generate short signal in ranging regime
    Given the market regime is RANGING
    And the close price has touched or crossed above the upper Bollinger Band (20, 2.0)
    And RSI-14 is above 65
    When the mean reversion strategy evaluates the current candle
    Then a SHORT signal is generated
    And the target price is the Bollinger Band midline
    And the stop-loss is set at upper band plus 0.5x band width

  Scenario: Signal blocked by existing position on same pair
    Given the market regime is TRENDING
    And a LONG signal would be generated for "BTCUSDT"
    And there is already an open LONG position on "BTCUSDT"
    When the AMMR strategy evaluates the current candle
    Then no new signal is generated
    And the existing position is not modified
