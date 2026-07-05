"""Data-drift monitoring with Evidently (issue #17).

Compares a reference frame against a current frame with Evidently's
``DataDriftPreset`` and returns a compact summary: a dataset-drift flag, the
drifted-column count and share, and per-column K-S p-values. Optionally writes
the full HTML report. The ``__main__`` CLI splits the daily temperature series
into an earlier reference window and a recent current window and reports whether
the target drifted.

``evidently`` is imported lazily inside the functions so importing this module
never requires the ``mlops`` extra.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd

# Stable Evidently metric type tags (matched instead of display names).
_DRIFTED_COUNT_TYPE = "evidently:metric_v2:DriftedColumnsCount"
_VALUE_DRIFT_TYPE = "evidently:metric_v2:ValueDrift"
# A dataset is flagged as drifted when at least this share of columns drift
# (Evidently's DataDriftPreset default drift_share).
_DRIFT_SHARE_THRESHOLD = 0.5


def data_drift_report(
    reference: pd.DataFrame,
    current: pd.DataFrame,
    *,
    numerical_columns: list[str] | None = None,
    html_path: str | Path | None = None,
) -> dict[str, Any]:
    """Run an Evidently data-drift report and return a compact summary.

    Args:
        reference: Baseline frame.
        current: Frame to compare against the baseline.
        numerical_columns: Numerical columns to check; defaults to all columns.
        html_path: When given, the full HTML report is written there.

    Returns:
        ``{dataset_drift, drifted_columns, share, columns: {col: {p_value, drifted}}}``.
    """
    from evidently import DataDefinition, Dataset, Report
    from evidently.presets import DataDriftPreset

    cols = list(numerical_columns) if numerical_columns else list(reference.columns)
    data_definition = DataDefinition(numerical_columns=cols)
    ref_ds = Dataset.from_pandas(reference, data_definition=data_definition)
    cur_ds = Dataset.from_pandas(current, data_definition=data_definition)

    report = Report(metrics=[DataDriftPreset()])
    result = report.run(reference_data=ref_ds, current_data=cur_ds)
    if html_path is not None:
        result.save_html(str(html_path))

    return _summarize(result.dict()["metrics"])


def _summarize(metrics: list[dict[str, Any]]) -> dict[str, Any]:
    drifted_columns = 0
    share = 0.0
    columns: dict[str, dict[str, Any]] = {}
    for metric in metrics:
        config = metric.get("config", {})
        mtype = config.get("type")
        value = metric.get("value")
        if value is None:
            continue
        if mtype == _DRIFTED_COUNT_TYPE:
            drifted_columns = int(value["count"])
            share = float(value["share"])
        elif mtype == _VALUE_DRIFT_TYPE:
            threshold = float(config.get("threshold", 0.05))
            p_value = float(value)
            columns[config.get("column")] = {
                "p_value": p_value,
                "drifted": p_value < threshold,
            }
    return {
        "dataset_drift": share >= _DRIFT_SHARE_THRESHOLD,
        "drifted_columns": drifted_columns,
        "share": share,
        "columns": columns,
    }


def _daily_from_raw(project_root: Path) -> pd.DataFrame:
    from weather_forecast.data_loader import load_raw_weather

    df = load_raw_weather(project_root)
    daily = (
        df.groupby(df["last_updated"].dt.normalize())["temperature_celsius"].mean().reset_index()
    )
    daily.columns = ["ds", "y"]
    return daily.sort_values("ds").reset_index(drop=True)


def main(argv: list[str] | None = None) -> int:
    """CLI: report data drift between an earlier and a recent window of the series."""
    parser = argparse.ArgumentParser(
        prog="weather_forecast.drift",
        description="Report data drift between a reference and a current window.",
    )
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--window-days",
        type=int,
        default=30,
        help="Size of each of the reference and current windows.",
    )
    parser.add_argument("--html", type=Path, default=None, help="Optional HTML report path.")
    args = parser.parse_args(argv)

    daily = _daily_from_raw(args.project_root)
    w = args.window_days
    reference = daily.iloc[-2 * w : -w][["y"]].reset_index(drop=True)
    current = daily.iloc[-w:][["y"]].reset_index(drop=True)

    summary = data_drift_report(reference, current, numerical_columns=["y"], html_path=args.html)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
