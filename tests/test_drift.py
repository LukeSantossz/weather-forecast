"""Unit tests for weather_forecast.drift (issue #17).

Skipped unless Evidently is installed (the ``mlops`` extra). Drift is exercised
with seeded frames so the K-S test result is deterministic.
"""

import json

import numpy as np
import pandas as pd
import pytest

pytest.importorskip("evidently")

from weather_forecast.drift import data_drift_report, main  # noqa: E402


def _frames(shift: float) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(0)
    ref = pd.DataFrame({"y": rng.normal(20.0, 1.0, 300)})
    cur = pd.DataFrame({"y": rng.normal(20.0 + shift, 1.0, 300)})
    return ref, cur


def test_drift_flags_shifted_distribution() -> None:
    ref, cur = _frames(shift=5.0)
    summary = data_drift_report(ref, cur, numerical_columns=["y"])
    assert summary["dataset_drift"] is True
    assert summary["drifted_columns"] >= 1
    assert summary["columns"]["y"]["drifted"] is True


def test_drift_absent_on_identical_distribution() -> None:
    rng = np.random.default_rng(1)
    same = pd.DataFrame({"y": rng.normal(20.0, 1.0, 300)})
    summary = data_drift_report(same.copy(), same.copy(), numerical_columns=["y"])
    assert summary["dataset_drift"] is False
    assert summary["share"] == 0.0


def test_drift_report_writes_html(tmp_path) -> None:
    ref, cur = _frames(shift=5.0)
    html = tmp_path / "drift.html"
    data_drift_report(ref, cur, numerical_columns=["y"], html_path=html)
    assert html.exists()
    assert html.stat().st_size > 0


def test_drift_cli_reports_summary(tmp_path, capsys) -> None:
    data_dir = tmp_path / "data" / "raw"
    data_dir.mkdir(parents=True)
    n = 120
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    rng = np.random.default_rng(0)
    y = rng.normal(20.0, 1.0, n)
    y[-30:] += 6.0  # shift the recent window so it drifts from the reference
    pd.DataFrame({"last_updated": dates, "temperature_celsius": y}).to_csv(
        data_dir / "GlobalWeatherRepository.csv", index=False
    )

    rc = main(["--project-root", str(tmp_path), "--window-days", "30"])
    assert rc == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["dataset_drift"] is True
