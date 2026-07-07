# ADR 0009: Lag + rolling features (1-21 days)

- Status: Accepted (2026-07-07).
- Source: README Engineering Decisions.

## Context

The temperature series has autoregressive structure that raw values alone do not expose to
the models.

## Decision

Engineer lag and rolling features over a 1-21 day window.

## Consequences

- Captures autoregressive structure; under the leakage-free evaluation (#20) the ML models
  (RMSE 0.27-0.32) clearly beat the classical baselines (0.73-0.80).
- Alternative considered: raw values only, rejected because it does not capture the
  autoregressive structure.
