"""API tests via TestClient (SPEC 0025, issue #16).

Every endpoint is exercised without a network: ``TestClient`` drives the ASGI
app in-process, and the forecaster is a small persisted fixture under
``tmp_path`` pointed to by the ``MODELS_DIR`` env var the app reads at startup.
"""

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from weather_forecast.api.app import app
from weather_forecast.models import fit_arima
from weather_forecast.persistence import save_artifact


def _persist_forecaster(models_dir, *, version: str = "v1") -> None:
    idx = pd.date_range("2020-01-01", periods=80, freq="D")
    series = pd.Series(20.0 + np.sin(np.arange(80) / 7.0) + np.linspace(0.0, 2.0, 80), index=idx)
    save_artifact(
        fit_arima(series),
        {"metrics": {"arima": {"rmse_c": 0.5}}},
        models_dir=models_dir,
        name="forecaster",
        version=version,
    )


def _batch(n: int = 30) -> list[dict]:
    rows = [
        {
            "temperature_celsius": 20.0,
            "humidity": 50.0 + (i % 5),
            "wind_kph": 10.0,
            "pressure_mb": 1012.0,
            "precip_mm": 0.0,
        }
        for i in range(n)
    ]
    rows.append(
        {
            "temperature_celsius": 60.0,
            "humidity": 50.0,
            "wind_kph": 10.0,
            "pressure_mb": 1012.0,
            "precip_mm": 0.0,
        }
    )
    return rows


def test_health_returns_200(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_anomaly_flags_batch(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    rows = _batch()
    with TestClient(app) as client:
        resp = client.post("/anomaly", json={"observations": rows})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) == len(rows)
    first = body["results"][0]
    assert set(first) >= {"index", "z_score", "z_anomaly", "if_anomaly", "if_score"}
    # The injected extreme temperature is flagged by the Z-score detector.
    assert body["results"][-1]["z_anomaly"] is True


def test_forecast_uses_persisted_model(monkeypatch, tmp_path) -> None:
    _persist_forecaster(tmp_path)
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    with TestClient(app) as client:
        resp = client.post("/forecast", json={"horizon": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["predictions"]) == 5
    assert body["model_version"] == "v1"


def test_forecast_without_model_returns_503(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    with TestClient(app) as client:
        resp = client.post("/forecast", json={"horizon": 5})
    assert resp.status_code == 503


def test_invalid_input_returns_422(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    with TestClient(app) as client:
        resp = client.post("/forecast", json={"horizon": 0})
    assert resp.status_code == 422


def test_anomaly_rejects_tiny_batch(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    # A single observation cannot be scored against a reference distribution;
    # the endpoint requires a minimum batch and rejects smaller ones.
    with TestClient(app) as client:
        resp = client.post("/anomaly", json={"observations": _batch(1)[:1]})
    assert resp.status_code == 422
