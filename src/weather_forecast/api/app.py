"""FastAPI serving app (issue #16, SPEC 0025).

Three endpoints: ``GET /health`` (liveness), ``POST /anomaly`` (a batch run
through the stateless Z-score + Isolation Forest detectors), and
``POST /forecast`` (steps ahead from a persisted forecaster loaded at startup,
``503`` when none is present). The forecaster is loaded from the directory named
by the ``MODELS_DIR`` env var (default ``models``) via #15's ``load_artifact``.

Run locally with ``uvicorn weather_forecast.api.app:app`` or ``docker compose up``.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException

from weather_forecast.anomaly import (
    DEFAULT_IF_FEATURES,
    isolation_forest_anomalies,
    zscore_anomalies,
)
from weather_forecast.api.schemas import (
    AnomalyRequest,
    AnomalyResponse,
    AnomalyResult,
    ForecastRequest,
    ForecastResponse,
    HealthResponse,
)
from weather_forecast.models import forecast_steps
from weather_forecast.persistence import load_artifact

_FORECASTER_NAME = "forecaster"


def _load_forecaster(models_dir: str | Path) -> tuple[Any, str] | None:
    """Load the latest persisted forecaster, or ``None`` if there is none."""
    try:
        payload, meta = load_artifact(models_dir, _FORECASTER_NAME, version="latest")
    except FileNotFoundError:
        return None
    return payload, str(meta.get("version", "unknown"))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load the persisted forecaster once at startup into app state."""
    loaded = _load_forecaster(os.environ.get("MODELS_DIR", "models"))
    app.state.forecaster = loaded[0] if loaded else None
    app.state.forecaster_version = loaded[1] if loaded else None
    yield


app = FastAPI(
    title="weather-forecast serving API",
    version="0.1.0",
    description="Forecasting and anomaly-detection endpoints over the trained pipeline.",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness probe; also reports whether a forecaster is loaded."""
    return HealthResponse(
        status="ok",
        model_loaded=app.state.forecaster is not None,
        model_version=app.state.forecaster_version,
    )


@app.post("/anomaly", response_model=AnomalyResponse)
def detect_anomaly(request: AnomalyRequest) -> AnomalyResponse:
    """Score a batch with the Z-score and Isolation Forest detectors.

    Detection is batch-relative: the detectors fit on the submitted batch, so a
    row is flagged relative to the others in the same request (not a persisted
    reference distribution). Batches below ``MIN_ANOMALY_BATCH`` are rejected.
    """
    frame = pd.DataFrame([obs.model_dump() for obs in request.observations])
    z_scores, z_flags = zscore_anomalies(frame["temperature_celsius"])
    if_flags, if_scores = isolation_forest_anomalies(frame[list(DEFAULT_IF_FEATURES)])
    results = [
        AnomalyResult(
            index=i,
            z_score=float(z_scores.iloc[i]),
            z_anomaly=bool(z_flags.iloc[i]),
            if_anomaly=bool(if_flags.iloc[i]),
            if_score=float(if_scores.iloc[i]),
        )
        for i in range(len(frame))
    ]
    return AnomalyResponse(results=results)


@app.post("/forecast", response_model=ForecastResponse)
def forecast(request: ForecastRequest) -> ForecastResponse:
    """Forecast ``horizon`` steps from the persisted forecaster (``503`` if none)."""
    fit = app.state.forecaster
    if fit is None:
        raise HTTPException(status_code=503, detail="No forecaster artifact is loaded")
    predictions = forecast_steps(fit, request.horizon)
    return ForecastResponse(
        horizon=request.horizon,
        predictions=[float(p) for p in predictions],
        model_name=_FORECASTER_NAME,
        model_version=app.state.forecaster_version,
    )
