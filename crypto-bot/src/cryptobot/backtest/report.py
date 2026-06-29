"""Backtest report generation — JSON and HTML output."""

import json
import os
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from cryptobot.backtest.metrics import BacktestMetrics


def save_report(
    metrics: BacktestMetrics,
    config: dict,
    output_dir: str = "data/backtest_results",
) -> str:
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    run_id = f"bt_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    report = {"run_id": run_id, **asdict(metrics), "parameters": config}

    json_path = os.path.join(output_dir, f"{run_id}.json")
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2)

    html_path = os.path.join(output_dir, f"{run_id}.html")
    _write_html(report, html_path)

    return run_id


def _write_html(report: dict, path: str) -> None:
    rows = "".join(
        f"<tr><td>{k.replace('_', ' ').title()}</td><td><b>{v}</b></td></tr>"
        for k, v in report.items()
        if k not in ("parameters", "run_id")
    )
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Backtest {report['run_id']}</title>
<style>body{{font-family:monospace;max-width:700px;margin:40px auto}}
table{{border-collapse:collapse;width:100%}}
td{{padding:6px 12px;border-bottom:1px solid #eee}}</style></head>
<body><h1>Backtest Report</h1><p>Run: {report['run_id']}</p>
<table>{rows}</table></body></html>"""
    with open(path, "w") as f:
        f.write(html)
