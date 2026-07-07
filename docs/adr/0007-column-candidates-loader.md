# ADR 0007: Column-candidates pattern in the data loader

- Status: Accepted (2026-07-07).
- Source: README Engineering Decisions.

## Context

The Kaggle dataset varies its column naming across versions, so the data loader cannot rely
on a single fixed set of column names.

## Decision

Use a column-candidates pattern in the data loader (`data_loader`).

## Consequences

- Handles schema variation across Kaggle dataset versions gracefully.
- Alternative considered: hardcoded column names, rejected because it cannot absorb schema
  variation across dataset versions.
