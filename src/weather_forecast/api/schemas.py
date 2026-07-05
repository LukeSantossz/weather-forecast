"""Pydantic request/response schemas for the serving API (issue #16).

These models validate the wire contract: invalid bodies are rejected by FastAPI
with HTTP 422 before any handler runs, and responses are serialized through the
declared ``response_model`` so the API surface stays typed and documented.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AnomalyObservation(BaseModel):
    """A single weather observation scored by both detectors."""

    temperature_celsius: float
    humidity: float
    wind_kph: float
    pressure_mb: float
    precip_mm: float


class AnomalyRequest(BaseModel):
    """A batch of observations to run through the stateless detectors."""

    observations: list[AnomalyObservation] = Field(..., min_length=1)


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
