# SPEC 0002 — fix(preprocessing): guard zero-width IQR bounds

## Problem
`detect_outliers_iqr` computes IQR fences without guarding IQR == 0; for a zero-inflated or near-constant column (Q1 == Q3) the bounds collapse to (0, 0) and `treat_outliers_iqr` clips every value — including legitimate non-zero ones — to zero, silently erasing the feature's signal.

## Design Decision
When `iqr == 0` for a column, emit no bounds for that column (skip it). `treat_outliers_iqr` already skips columns absent from the bounds dict, so the column passes through untouched. Smallest correct behavior; no alternative fence strategy introduced.

## Scope
- Includes: a guard in `detect_outliers_iqr` skipping columns where IQR == 0; a docstring note; a regression test.
- Does NOT include: changing `treat_outliers_iqr`; a new outlier strategy; other pipeline steps; any notebook or Parquet consumer.

## Acceptance Criteria
- detect_outliers_iqr omits columns where IQR == 0.
- A zero-inflated column keeps its non-zero values after `treat_outliers_iqr`.
- The existing 41 tests still pass.

## Reproducibility
`./.venv/Scripts/python -m pytest tests/test_preprocessing.py -q`. Deterministic.

## Risks and Assumptions
Skipping (not widening) the fence is acceptable: a zero-IQR column has no IQR-defined outliers. Low risk; isolated pure function; the cleaned Parquet is currently orphaned so no downstream consumer is affected.
