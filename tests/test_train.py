"""Unit tests for weather_forecast.train."""

import numpy as np
import pandas as pd
import pytest

from weather_forecast.config import PipelineConfig
from weather_forecast.models import forecast_steps
from weather_forecast.persistence import load_artifact
from weather_forecast.train import main, run_forecast

_CFG = PipelineConfig.from_dict({"test_window_days": 8, "val_size": 8})


def _daily(n: int = 100) -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    y = 20 + 5 * np.sin(2 * np.pi * np.arange(n) / 7) + np.arange(n) * 0.03
    return pd.DataFrame({"ds": idx, "y": y})


def test_run_forecast_reports_all_models() -> None:
    res = run_forecast(_daily(), config=_CFG)
    assert set(res) >= {
        "arima",
        "sarima",
        "lightgbm",
        "gradientboosting",
        "ensemble_simple",
        "ensemble_weighted",
    }
    for m in res.values():
        assert set(m) == {"rmse_c", "mae_c", "mape_pct"}


def test_run_forecast_is_reproducible() -> None:
    a = run_forecast(_daily(), config=_CFG)
    b = run_forecast(_daily(), config=_CFG)
    assert a == b


def test_run_forecast_seed_changes_results() -> None:
    cfg1 = PipelineConfig.from_dict({"test_window_days": 8, "val_size": 8, "seed": 1})
    cfg2 = PipelineConfig.from_dict({"test_window_days": 8, "val_size": 8, "seed": 2})
    a = run_forecast(_daily(), config=cfg1)
    b = run_forecast(_daily(), config=cfg2)
    # The seed must actually reach the stochastic estimators.
    assert (a["lightgbm"], a["gradientboosting"]) != (b["lightgbm"], b["gradientboosting"])


def test_run_forecast_rejects_invalid_windows() -> None:
    with pytest.raises(ValueError, match="val_size"):
        run_forecast(_daily(), config=PipelineConfig.from_dict({"val_size": 0}))
    with pytest.raises(ValueError, match="test_window_days|val_size|training"):
        run_forecast(
            _daily(60), config=PipelineConfig.from_dict({"test_window_days": 40, "val_size": 40})
        )


def test_cli_runs_end_to_end_and_reports_metrics(tmp_path, capsys) -> None:
    data_dir = tmp_path / "data" / "raw"
    data_dir.mkdir(parents=True)
    n = 140
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    y = 20 + 5 * np.sin(2 * np.pi * np.arange(n) / 7) + np.arange(n) * 0.03
    pd.DataFrame({"last_updated": dates, "temperature_celsius": y}).to_csv(
        data_dir / "GlobalWeatherRepository.csv", index=False
    )

    rc = main(
        [
            "--project-root",
            str(tmp_path),
            "--test-window-days",
            "8",
            "--val-size",
            "8",
        ]
    )
    assert rc == 0
    out = capsys.readouterr().out
    assert "lightgbm" in out
    assert "rmse" in out.lower()


def test_cli_save_persists_forecaster(tmp_path) -> None:
    data_dir = tmp_path / "data" / "raw"
    data_dir.mkdir(parents=True)
    n = 140
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    y = 20 + 5 * np.sin(2 * np.pi * np.arange(n) / 7) + np.arange(n) * 0.03
    pd.DataFrame({"last_updated": dates, "temperature_celsius": y}).to_csv(
        data_dir / "GlobalWeatherRepository.csv", index=False
    )
    models_dir = tmp_path / "models"

    rc = main(
        [
            "--project-root",
            str(tmp_path),
            "--test-window-days",
            "8",
            "--val-size",
            "8",
            "--save",
            "--models-dir",
            str(models_dir),
        ]
    )
    assert rc == 0

    forecaster, meta = load_artifact(models_dir, "forecaster", version="latest")
    assert "metrics" in meta
    assert set(meta["metrics"]) >= {"arima", "ensemble_weighted"}
    assert len(forecast_steps(forecaster, 3)) == 3


def test_cli_track_creates_run(tmp_path) -> None:
    pytest.importorskip("mlflow")
    from mlflow.tracking import MlflowClient

    data_dir = tmp_path / "data" / "raw"
    data_dir.mkdir(parents=True)
    n = 140
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    y = 20 + 5 * np.sin(2 * np.pi * np.arange(n) / 7) + np.arange(n) * 0.03
    pd.DataFrame({"last_updated": dates, "temperature_celsius": y}).to_csv(
        data_dir / "GlobalWeatherRepository.csv", index=False
    )
    uri = "file:///" + str(tmp_path / "mlruns").replace("\\", "/")

    rc = main(
        [
            "--project-root",
            str(tmp_path),
            "--test-window-days",
            "8",
            "--val-size",
            "8",
            "--track",
            "--tracking-uri",
            uri,
        ]
    )
    assert rc == 0

    client = MlflowClient(uri)
    experiment = client.get_experiment_by_name("weather-forecast")
    runs = client.search_runs([experiment.experiment_id])
    assert len(runs) == 1
    assert runs[0].data.params["seed"] == "42"
    assert "arima.rmse_c" in runs[0].data.metrics
