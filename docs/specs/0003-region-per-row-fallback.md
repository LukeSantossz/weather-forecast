# SPEC 0003 — fix(data_loader): per-row timezone fallback in add_region_column

## Problem
`add_region_column` uses the continent column for all rows whenever it exists and has any non-null value; rows whose continent is null then receive the literal string "nan" instead of the documented per-row IANA-timezone fallback.

## Design Decision
Derive `region` per row: use continent where present and non-null; else the timezone prefix (area before the first "/"); else "Unknown". Keep the existing public signature.

## Scope
- Includes: rewrite the region derivation in `add_region_column` to be per-row; a regression test with a partially-null continent column.
- Does NOT include: changing the function signature; touching other functions/files; new columns.

## Acceptance Criteria
- A row with null continent but a valid timezone gets the timezone-derived region, not "nan".
- A fully-populated continent column behaves as before (region == continent).
- A fully-absent continent column falls back to the timezone prefix as before.
- No continent and no timezone → "Unknown".
- Existing tests still pass.

## Reproducibility
`./.venv/Scripts/python -m pytest tests/test_data_loader.py -q`. Deterministic.

## Risks and Assumptions
Pure function on a copy; low risk. `combine_first`/`where` on aligned Series preserves index.
