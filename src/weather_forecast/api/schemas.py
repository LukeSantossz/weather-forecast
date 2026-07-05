"""Pydantic request/response schemas for the serving API (issue #16).

These models validate the wire contract: invalid bodies are rejected by FastAPI
with HTTP 422 before any handler runs, and responses are serialized through the
declared ``response_model`` so the API surface stays typed and documented.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# The detectors score each request batch relative to itself (a population
# Z-score and an Isolation Forest fit on the batch), so a batch that is too
# small yields a degenerate verdict (a lone row always has z=0). Require a
# minimum batch so callers cannot get a meaningless result.
MIN_ANOMALY_BATCH = 10


class AnomalyObservation(BaseModel):
    """A single weather observation scored by both detectors."""

    temperature_celsius: float
    humidity: float
    wind_kph: float
    pressure_mb: float
    precip_mm: float


class AnomalyRequest(BaseModel):
    """A batch of observations scored relative to itself by the detectors.

    Requires at least ``MIN_ANOMALY_BATCH`` observations; smaller batches yield
    a degenerate verdict and are rejected with HTTP 422.
    """

    observations: list[AnomalyObservation] = Field(..., min_length=MIN_ANOMALY_BATCH)


class AnomalyResult(BaseModel):
    """Per-row detector output aligned to the request order."""

    index: int
    z_score: float
    z_anomaly: bool
    if_anomaly: bool
    if_score: float


class AnomalyResponse(BaseModel):
    results: list[AnomalyResult]


class ForecastRequest(BaseModel):
    """How many steps ahead to forecast."""

    horizon: int = Field(..., ge=1, le=365)


class ForecastResponse(BaseModel):
    horizon: int
    predictions: list[float]
    model_name: str
    model_version: str | None = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str | None = None
