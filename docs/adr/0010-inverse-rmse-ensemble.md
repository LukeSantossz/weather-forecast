# ADR 0010: Inverse-RMSE weighted ensemble

- Status: Accepted (2026-07-07).
- Source: README Engineering Decisions.

## Context

Combining the forecasting models requires a weighting scheme that diversifies risk without
overfitting to the test set.

## Decision

Combine the models with an inverse-RMSE weighted ensemble, with the weights set from
validation-set accuracy, not the test set.

## Consequences

- Risk diversification; weights are set from validation-set accuracy, not the test set.
- Alternatives considered: a simple average or a single best model, rejected because they do
  not diversify risk the way the inverse-RMSE weighting does.
