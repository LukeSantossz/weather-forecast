# ADR 0005: IQR clipping for outliers

- Status: Accepted (2026-07-07).
- Source: README Engineering Decisions.

## Context

Raw observations contain outliers that must be handled before forecasting. The data is a
time series, so the handling method must not break temporal continuity.

## Decision

Clip outliers using the interquartile range (IQR) rather than removing them.

## Consequences

- Preserves temporal continuity.
- Alternative considered: Z-score removal, rejected because it drops entire rows, breaking
  the time series.
