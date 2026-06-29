"""CryptoBot CLI — commands: backtest, paper, live, report, go-live."""

import click
from rich.console import Console
from rich.table import Table

console = Console()


@click.group()
def cli():
    """CryptoBot — Automated AMMR trading on Binance SPOT."""


@cli.command()
@click.option("--pair", default="BTCUSDT", help="Trading pair")
@click.option("--from", "from_date", default="2023-01-01", help="Start date YYYY-MM-DD")
@click.option("--to", "to_date", default=None, help="End date YYYY-MM-DD (default: today)")
@click.option("--capital", default=5000.0, type=float, help="Initial capital in EUR")
def backtest(pair: str, from_date: str, to_date: str | None, capital: float):
    """Run a backtest and print performance metrics."""
    from datetime import datetime

    from cryptobot.backtest.engine import BacktestConfig, BacktestEngine
    from cryptobot.backtest.report import save_report
    from cryptobot.config.settings import get_settings
    from cryptobot.data.store import DataStore
    from cryptobot.monitoring.logger import configure_logging

    settings = get_settings()
    configure_logging(settings.log_level)

    store = DataStore()
    from_dt = datetime.fromisoformat(from_date)
    to_dt = datetime.fromisoformat(to_date) if to_date else None

    df = store.load_candles(pair, settings.timeframe, from_dt, to_dt)
    if df.empty:
        console.print(f"[red]No data for {pair}. Run download-history first.[/red]")
        raise SystemExit(1)

    config = BacktestConfig(pair=pair, timeframe=settings.timeframe, initial_capital=capital)
    engine = BacktestEngine(config)
    metrics = engine.run(df)

    run_id = save_report(metrics, {"pair": pair, "from": from_date, "to": to_date or "today"})

    table = Table(title=f"Backtest Results — {pair}", show_header=True)
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="bold")
    for k, v in vars(metrics).items():
        table.add_row(k.replace("_", " ").title(), str(v))

    console.print(table)
    console.print(f"\nReport saved: data/backtest_results/{run_id}.json")


@cli.command()
@click.option("--pair", default="BTCUSDT")
@click.option("--days", default=365, type=int, help="Days of historical data to fetch")
def download_history(pair: str, days: int):
    """Download historical OHLCV data from Binance and store locally."""
    from datetime import datetime, timedelta, timezone

    from cryptobot.config.settings import get_settings
    from cryptobot.data.fetcher import BinanceFetcher
    from cryptobot.data.store import DataStore

    settings = get_settings()
    fetcher = BinanceFetcher()
    store = DataStore()

    from_dt = datetime.now(tz=timezone.utc) - timedelta(days=days)
    console.print(f"Fetching {days} days of {pair} {settings.timeframe}...")

    df = fetcher.fetch_historical(pair, settings.timeframe, from_dt)
    inserted = store.upsert_candles(df, pair, settings.timeframe)
    console.print(f"[green]Stored {inserted} new candles for {pair}.[/green]")


@cli.command("go-live")
@click.option("--confirm", is_flag=True, help="Confirm intent to switch to live mode")
def go_live(confirm: bool):
    """Check gate criteria and optionally switch to live mode."""
    import json
    from pathlib import Path

    from cryptobot.config.constants import (
        GO_LIVE_MAX_DRAWDOWN, GO_LIVE_MIN_PAPER_DAYS,
        GO_LIVE_MIN_SHARPE, GO_LIVE_MIN_TRADES,
    )

    results_dir = Path("data/backtest_results")
    paper_reports = sorted(results_dir.glob("paper_*.json"))

    if not paper_reports:
        console.print("[red]No paper trading reports found. Run paper mode first.[/red]")
        raise SystemExit(1)

    latest = json.loads(paper_reports[-1].read_text())

    gates = [
        ("G-01 Duration", f"{latest.get('paper_days', 0)} days", latest.get("paper_days", 0) >= GO_LIVE_MIN_PAPER_DAYS),
        ("G-02 Trades", str(latest.get("total_trades", 0)), latest.get("total_trades", 0) >= GO_LIVE_MIN_TRADES),
        ("G-03 Sharpe", str(latest.get("sharpe_ratio", 0.0)), latest.get("sharpe_ratio", 0.0) >= GO_LIVE_MIN_SHARPE),
        ("G-04 Max DD", f"{latest.get('max_drawdown_pct', 100):.1f}%", latest.get("max_drawdown_pct", 100) < GO_LIVE_MAX_DRAWDOWN * 100),
    ]

    table = Table(title="Go-Live Gate Check", show_header=True)
    table.add_column("Gate", style="cyan")
    table.add_column("Value")
    table.add_column("Result")

    all_pass = True
    for name, value, passed in gates:
        result = "[green]PASS[/green]" if passed else "[red]FAIL[/red]"
        table.add_row(name, value, result)
        if not passed:
            all_pass = False

    console.print(table)

    if not all_pass:
        console.print("\n[red]Not all gate criteria met. Live mode not activated.[/red]")
        raise SystemExit(1)

    if confirm:
        console.print("\n[yellow]All gates PASS. Type 'CONFIRM' to switch to live mode:[/yellow]")
        user_input = input("> ").strip()
        if user_input == "CONFIRM":
            console.print("[green]Live mode activated. Update EXECUTION_MODE=LIVE in your .env[/green]")
        else:
            console.print("[red]Cancelled.[/red]")
    else:
        console.print("\n[yellow]Add --confirm flag to proceed to live mode.[/yellow]")


if __name__ == "__main__":
    cli()
