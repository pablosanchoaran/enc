"""
Tabla de evolución diaria y mensual de la inversión con compounding.

Escenarios basados en la simulación AMMR (simulate_month.py):
  - Bear:  3 pares, mercado bajista  → +3.98%/mes
  - Base:  9 pares, mercado mixto   → +8.0%/mes  (estimación conservadora)
  - Bull:  12 pares, 20% cap, bull  → +15.56%/mes

Muestra día a día y mes a mes hasta alcanzar los hitos de 50€/día y 100€/día.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.rule import Rule
from rich import box

console = Console(width=130)

# ─── parámetros ──────────────────────────────────────────────────────────────

INITIAL_CAPITAL = 5_000.0

# Tasas mensuales de cada escenario (de la simulación)
MONTHLY_RATES = {
    "bear": 0.0398,    # +3.98%/mes — mercado bajista, 3 pares
    "base": 0.0800,    # +8.0%/mes  — estimación conservadora, mercado mixto
    "bull": 0.1556,    # +15.56%/mes — bull run, 12 pares, 20% cap
}

# Tasa diaria compuesta equivalente: (1 + mensual)^(1/30) - 1
def daily_rate(monthly: float) -> float:
    return (1 + monthly) ** (1 / 30) - 1


DAILY_RATES = {k: daily_rate(v) for k, v in MONTHLY_RATES.items()}

MILESTONE_50  = 50.0    # €/día
MILESTONE_100 = 100.0   # €/día

SCENARIOS = [
    ("bear", "Bear",  "dim",          "Bajista  +3.98%/mes"),
    ("base", "Base",  "yellow",       "Mixto    +8.00%/mes"),
    ("bull", "Bull",  "bold green",   "Alcista +15.56%/mes"),
]


# ─── cálculo ─────────────────────────────────────────────────────────────────

def compound_series(initial: float, daily_r: float, n_days: int) -> list[float]:
    """Returns list of [capital after day 1, day 2, ...] with daily compounding."""
    caps = []
    cap = initial
    for _ in range(n_days):
        cap = cap * (1 + daily_r)
        caps.append(cap)
    return caps


def daily_pnl(capital: float, daily_r: float) -> float:
    return capital * daily_r


# ─── tabla diaria (primeros 90 días) ─────────────────────────────────────────

def display_daily_table(n_days: int = 90) -> None:
    console.print(Rule("[bold]Evolución día a día[/bold]"))
    console.print()

    # Pre-compute series for each scenario
    series = {}
    for key, _, _, _ in SCENARIOS:
        r = DAILY_RATES[key]
        caps = compound_series(INITIAL_CAPITAL, r, n_days)
        series[key] = caps

    t = Table(
        box=box.SIMPLE_HEAVY, pad_edge=False, show_footer=False,
        title=f"Compounding diario — {n_days} días (capital inicial: {INITIAL_CAPITAL:,.0f}€)",
    )
    t.add_column("Día",   style="dim", justify="right", min_width=4, no_wrap=True)

    for key, label, style, desc in SCENARIOS:
        t.add_column(f"Cap. {label}",   justify="right", style=style,  min_width=9,  no_wrap=True)
        t.add_column(f"P&L/día {label}", justify="right", style=style, min_width=9, no_wrap=True)

    # Milestones already hit
    milestones_hit: dict[str, set] = {k: set() for k, *_ in SCENARIOS}

    prev_caps = {k: INITIAL_CAPITAL for k, *_ in SCENARIOS}

    for day in range(1, n_days + 1):
        cols: list[str] = [str(day)]

        # Detect milestone crossings for this day
        tags: list[str] = []
        for key, label, style, _ in SCENARIOS:
            cap = series[key][day - 1]
            pnl_today = daily_pnl(prev_caps[key], DAILY_RATES[key])

            # milestone markers
            if "50" not in milestones_hit[key] and pnl_today >= MILESTONE_50:
                milestones_hit[key].add("50")
                tags.append(f"[bold cyan]{label}:[/bold cyan][cyan] 50€/día[/cyan]")
            if "100" not in milestones_hit[key] and pnl_today >= MILESTONE_100:
                milestones_hit[key].add("100")
                tags.append(f"[bold magenta]{label}:[/bold magenta][magenta] 100€/día[/magenta]")

            prev_caps[key] = cap

        # Row highlight every 30 days
        row_style = "on grey11" if day % 30 == 0 else None

        cells: list[str] = [str(day)]
        for key, label, style, _ in SCENARIOS:
            cap = series[key][day - 1]
            pnl_d = daily_pnl(series[key][day - 2] if day > 1 else INITIAL_CAPITAL,
                              DAILY_RATES[key])
            cells.append(f"{cap:,.0f}€")
            cells.append(f"+{pnl_d:.2f}€")

        if row_style:
            t.add_row(*cells, style=row_style)
        else:
            t.add_row(*cells)

        # Print milestone annotations right after that row
        for tag in tags:
            t.add_row("", "", "", "", "", "", style="bold")

    console.print(t)

    # Print milestone summary below table
    console.print()
    for key, label, style, _ in SCENARIOS:
        r = DAILY_RATES[key]
        cap = INITIAL_CAPITAL
        day_50 = day_100 = None
        for d in range(1, 1000):
            pnl_d = daily_pnl(cap, r)
            if day_50 is None and pnl_d >= MILESTONE_50:
                day_50 = d
            if day_100 is None and pnl_d >= MILESTONE_100:
                day_100 = d
            cap *= (1 + r)
            if day_100 is not None:
                break
        console.print(
            f"  [{style}]{label:5s}[/{style}]  "
            f"50€/día: día [bold]{day_50 or '>1000'}[/bold]  │  "
            f"100€/día: día [bold]{day_100 or '>1000'}[/bold]"
        )
    console.print()


# ─── tabla mensual (36 meses) ────────────────────────────────────────────────

def display_monthly_table(n_months: int = 36) -> None:
    console.print(Rule("[bold]Evolución mensual (compounding)[/bold]"))
    console.print()

    t = Table(
        box=box.SIMPLE_HEAVY, pad_edge=False,
        title=f"Proyección {n_months} meses — capital inicial: {INITIAL_CAPITAL:,.0f}€",
    )
    t.add_column("Mes",  style="dim", justify="right", min_width=4, no_wrap=True)

    for key, label, style, desc in SCENARIOS:
        t.add_column(f"Capital\n{label}", justify="right", style=style, min_width=10, no_wrap=True)
        t.add_column(f"P&L/mes\n{label}", justify="right", style=style, min_width=10, no_wrap=True)
        t.add_column(f"€/día avg\n{label}", justify="right", style=style, min_width=10, no_wrap=True)

    caps = {k: INITIAL_CAPITAL for k, *_ in SCENARIOS}
    milestones_hit: dict[str, set] = {k: set() for k, *_ in SCENARIOS}

    for month in range(1, n_months + 1):
        cells = [str(month)]
        row_tags: list[str] = []

        for key, label, style, _ in SCENARIOS:
            prev_cap = caps[key]
            new_cap = prev_cap * (1 + MONTHLY_RATES[key])
            pnl_month = new_cap - prev_cap
            pnl_day_avg = pnl_month / 30
            caps[key] = new_cap

            # milestone markers
            marker = ""
            if "50" not in milestones_hit[key] and pnl_day_avg >= MILESTONE_50:
                milestones_hit[key].add("50")
                marker = " ★50"
                row_tags.append(f"[bold cyan]{label} alcanza 50€/día (mes {month})[/bold cyan]")
            if "100" not in milestones_hit[key] and pnl_day_avg >= MILESTONE_100:
                milestones_hit[key].add("100")
                marker = " ★100"
                row_tags.append(f"[bold magenta]{label} alcanza 100€/día (mes {month})[/bold magenta]")

            cells.append(f"{new_cap:,.0f}€")
            cells.append(f"+{pnl_month:,.0f}€")
            cells.append(f"+{pnl_day_avg:.1f}€{marker}")

        # Highlight milestone months
        row_style = "bold on grey11" if row_tags else ("on grey11" if month % 6 == 0 else None)
        t.add_row(*cells, style=row_style)

    console.print(t)
    console.print()

    # Milestone summary
    console.print("  [bold cyan]★50[/bold cyan]  = mes en que el retorno diario promedio cruza 50€/día")
    console.print("  [bold magenta]★100[/bold magenta] = mes en que el retorno diario promedio cruza 100€/día")
    console.print()


# ─── panel resumen de milestones ──────────────────────────────────────────────

def display_milestone_panel() -> None:
    lines = ["[bold]¿Cuándo alcanza cada escenario los hitos de retorno diario?[/bold]\n"]

    for key, label, style, desc in SCENARIOS:
        r_m = MONTHLY_RATES[key]
        r_d = DAILY_RATES[key]

        # Día en que P&L diario ≥ 50€
        cap = INITIAL_CAPITAL
        day_50 = day_100 = None
        for d in range(1, 2000):
            if daily_pnl(cap, r_d) >= 50 and day_50 is None:
                day_50 = d
            if daily_pnl(cap, r_d) >= 100 and day_100 is None:
                day_100 = d
                break
            cap *= (1 + r_d)

        # Mes en que P&L mensual / 30 ≥ 50€
        cap_m = INITIAL_CAPITAL
        month_50 = month_100 = None
        for m in range(1, 200):
            cap_m *= (1 + r_m)
            avg_d = (cap_m - cap_m / (1 + r_m)) / 30
            if month_50 is None and avg_d >= 50:
                month_50 = m
            if month_100 is None and avg_d >= 100:
                month_100 = m
                break

        cap_at_50  = INITIAL_CAPITAL * (1 + r_m) ** (month_50 or 0)
        cap_at_100 = INITIAL_CAPITAL * (1 + r_m) ** (month_100 or 0)

        lines.append(
            f"  [{style}][bold]{label:5s}[/bold] ({desc})[/{style}]\n"
            f"    50€/día  → día [bold]{day_50 or '>2000':>4}[/bold]  "
            f"(mes {month_50 or '>200':>3})  capital: {cap_at_50:>9,.0f}€\n"
            f"   100€/día  → día [bold]{day_100 or '>2000':>4}[/bold]  "
            f"(mes {month_100 or '>200':>3})  capital: {cap_at_100:>9,.0f}€\n"
        )

    lines.append(
        "\n[dim]Capital necesario para 50€/día [italic]desde el primer día[/italic]:\n"
        f"  Bear (+{MONTHLY_RATES['bear']*100:.2f}%/mes): "
        f"{50 / DAILY_RATES['bear']:>10,.0f}€\n"
        f"  Base (+{MONTHLY_RATES['base']*100:.2f}%/mes): "
        f"{50 / DAILY_RATES['base']:>10,.0f}€\n"
        f"  Bull (+{MONTHLY_RATES['bull']*100:.2f}%/mes): "
        f"{50 / DAILY_RATES['bull']:>10,.0f}€[/dim]"
    )

    console.print(Panel("\n".join(lines), title="Hitos de retorno", border_style="cyan"))
    console.print()


# ─── entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    console.print()
    console.print(Panel(
        f"[bold]Tabla inversión-retorno — CryptoBot AMMR[/bold]\n"
        f"Capital inicial: [bold]{INITIAL_CAPITAL:,.0f}€[/bold]  │  "
        f"Escenarios: Bear/Base/Bull  │  Compounding diario",
        border_style="blue",
    ))
    console.print()

    display_milestone_panel()
    display_daily_table(n_days=90)
    display_monthly_table(n_months=36)
