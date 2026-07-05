"""Unit tests for weather_forecast.tracking (issue #17).

Skipped unless MLflow is installed (the ``mlops`` extra). Each test writes to an
isolated ``mlruns/`` file store under ``tmp_path`` and reads the run back through
``MlflowClient`` to assert params, metrics, and artifacts were recorded.
"""

import pytest

mlflow = pytest.importorskip("mlflow")

from mlflow.tracking import MlflowClient  # noqa: E402

from weather_forecast.tracking import log_training_run  # noqa: E402


def _uri(tmp_path) -> str:
    return "file:///" + str(tmp_path / "mlruns").replace("\\", "/")


def test_log_training_run_records_params_metrics_artifact(tmp_path) -> None:
    artifact = tmp_path / "model.txt"
    artifact.write_text("dummy artifact")
    uri = _uri(tmp_path)

    run_id = log_training_run(
        {"seed": 42, "test_window_days": 30},
        {
            "arima": {"rmse_c": 0.73, "mae_c": 0.57, "mape_pct": 2.43},
            "lightgbm": {"rmse_c": 0.32, "mae_c": 0.25, "mape_pct": 1.06},
        },
        tracking_uri=uri,
        experiment="test-exp",
        artifact_path=artifact,
    )

    client = MlflowClient(uri)
    run = client.get_run(run_id)
    assert run.data.params["seed"] == "42"
    assert run.data.params["test_window_days"] == "30"
    assert run.data.metrics["arima.rmse_c"] == 0.73
    assert run.data.metrics["lightgbm.mape_pct"] == 1.06
    artifacts = [a.path for a in client.list_artifacts(run_id)]
    assert "model.txt" in artifacts
