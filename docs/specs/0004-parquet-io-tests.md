# SPEC 0004 — test(parquet_io): add unit tests for parquet_io

## Problem
`src/parquet_io.py` is the only `src/` module with zero tests, despite the project advertising a tested `src/` package and mandating test-first development.

## Design Decision
Add `tests/test_parquet_io.py` covering `write_dataframe_parquet`: nested-directory creation, round-trip read-back equality, and `preserve_index` True/False. Additive only; no production change.

## Scope
- Includes: new `tests/test_parquet_io.py`.
- Does NOT include: changing `src/parquet_io.py` or any other file.

## Acceptance Criteria
- A round-trip test writes a DataFrame and reads it back equal.
- Writing to a not-yet-existing nested path creates the directories.
- `preserve_index` behavior is asserted for both True and False.
- All tests pass.

## Reproducibility
`./.venv/Scripts/python -m pytest tests/test_parquet_io.py -q`. Deterministic.

## Risks and Assumptions
Additive coverage; no runtime surface changed. Low risk.
