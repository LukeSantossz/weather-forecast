# syntax=docker/dockerfile:1
# Multi-stage build: install the package and its serving deps into a prefix in a
# builder stage, then copy only that prefix into a slim runtime image.

FROM python:3.11-slim AS builder
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
RUN python -m pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install ".[serving]"

FROM python:3.11-slim AS runtime
WORKDIR /app
# libgomp1 provides libgomp.so.1, the OpenMP runtime LightGBM loads at import.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /install /usr/local
# Where the app looks for the persisted forecaster artifact (issue #15).
ENV MODELS_DIR=/app/models
EXPOSE 8000
CMD ["uvicorn", "weather_forecast.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
