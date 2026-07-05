# SPEC: feat(serving): FastAPI inference service + Docker

## Problem
There is no way to get a prediction outside a notebook. With the logic in `src` (#14) and persistence available (#15), a thin FastAPI service can serve forecasts and anomaly checks, containerized for deployment. This is issue #16 (phase-3, epic). Per the issue it splits into SPECs; this SPEC is the first, cohesive deliverable (API + model loading + Docker), with CD/push deferred.

## Design Decision
Add a `weather_forecast/api/` package: a FastAPI app with Pydantic-validated schemas and three endpoints, `GET /health` (liveness, 200), `POST /anomaly` (a batch of observations run through the stateless Z-score + Isolation Forest detectors from the `anomaly` module), and `POST /forecast` (a horizon → forecasts from a persisted forecaster loaded via #15's `load_artifact`; `503` if no artifact is present). Add a `--save` flag to the `train` CLI (#14) that persists the fitted ARIMA forecaster as a versioned artifact, so `POST /forecast` has something to load. Add `fastapi`/`uvicorn` as a `serving` optional-dependency extra (with `httpx` in `dev` for the test client), a slim multi-stage `Dockerfile` and `docker-compose.yml`, a CI `docker-build` job, and a README API section.

## Alternatives Considered
- **Train on startup instead of loading a persisted model.** Rejected: training on boot needs the dataset in the image and slows startup; loading a versioned artifact is the serving-correct path and exercises #15.
- **Flask / a bare WSGI app.** Rejected: FastAPI gives Pydantic validation and OpenAPI docs for free, matching the issue.
- **Put `fastapi`/`uvicorn` in core deps.** Rejected: they are serving-only; a `serving` extra keeps the core install lean. CI test/lint install `-e .[dev,serving]` so the API is testable.
- **One giant PR for API + Docker + CD.** Rejected: CD/registry push and auth are deferred to a follow-up SPEC so this stays reviewable.

## Scope
- Includes:
  - `weather_forecast/api/schemas.py` (Pydantic request/response models) and `weather_forecast/api/app.py` (FastAPI app, routers, startup model load from `MODELS_DIR`).
  - Endpoints: `GET /health`, `POST /anomaly`, `POST /forecast` (loads a persisted forecaster; `503` when absent).
  - `train --save`: persist the fitted ARIMA forecaster via `persistence.save_artifact` (name `forecaster`).
  - `serving` extra (`fastapi`, `uvicorn`); `httpx` added to `dev` for `TestClient`.
  - `Dockerfile` (multi-stage, slim), `docker-compose.yml`, a CI `docker-build` job, and a README "API" section.
  - Tests via `fastapi.testclient.TestClient`: health, anomaly, forecast (with a persisted fixture), and a 422 on invalid input.
- Does NOT include:
  - Auth, rate limiting, CD/registry push (a later #16 sub-SPEC).
  - Serving the full weighted ensemble (the first forecaster is ARIMA; richer forecasters follow).
  - MLflow (#17) or drift monitoring.

## Acceptance Criteria
- `health_returns_200`: `GET /health` returns 200 with a status body.
- `anomaly_flags_batch`: `POST /anomaly` with a batch of observations returns per-row Z-score/IF flags and IF scores, Pydantic-validated.
- `forecast_uses_persisted_model`: with a persisted `forecaster` artifact, `POST /forecast` with a horizon returns that many predictions; with none, it returns `503`.
- `invalid_input_returns_422`: a malformed request body returns HTTP 422.
- `train_save_persists_artifact`: `train --save` writes a loadable `forecaster` artifact whose metadata carries the run metrics.
- `docker_build_succeeds`: `docker build` produces an image (verified in CI); `docker compose up` serves `/health` (documented; run locally).
- Existing suite passes; `ruff`/`mypy` clean; README documents the endpoints.

## Reproducibility
`pip install -e .[dev,serving]` then `pytest tests/test_api.py -q`; run locally with `uvicorn weather_forecast.api.app:app` or `docker compose up`. The API tests use `TestClient` (no network) and a persisted fixture model in `tmp_path`. Python 3.10; FastAPI/uvicorn pinned at implementation.

## Risks and Assumptions
- Assumption: `POST /forecast` serves a persisted ARIMA forecaster (produced by `train --save`); the weighted-ensemble service is a follow-up, since persisting/serving four models plus the ensemble weights is more than a first slice needs.
- Assumption: Docker build runs in CI (Linux); local `docker compose up` is documented but not asserted by unit tests.
- Medium risk: new web-framework surface. Mitigated by `TestClient` coverage of every endpoint and the 422 path, and by keeping serving deps in an extra so the core stays unaffected.
- This introduces a durable serving architecture (FastAPI + artifact loading); a promotion to an ADR at the Gate is reasonable.
