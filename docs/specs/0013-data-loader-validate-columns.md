# SPEC: fix(data_loader): validate required columns independently of date parsing

## Problem
When `last_updated` is absent, `pd.read_csv(parse_dates=["last_updated"])` raises pandas' less-actionable error before `load_raw_weather`'s own required-columns check runs, so the documented `ValueError: Missing required columns` never fires for that column.

## Design Decision
Read the CSV without `parse_dates`, run the required-columns check against `df.columns` first, then parse `last_updated` with `pd.to_datetime(..., errors="coerce")`. The boundary validator owns its error contract instead of depending on a pandas side effect, so the error message is identical regardless of which required column is missing.

## Alternatives Considered
- **Keep `parse_dates` and catch pandas' error to re-raise the project message.** Rejected: fragile string-matching on a library error, and it still parses before validating, mixing concerns.
- **Wrap `parse_dates` in try/except with a fallback read.** Rejected: hides the real failure path and complicates control flow for no gain over a simple reorder.

## Scope
- Includes: reorder read -> validate -> parse in `load_raw_weather`; a test for the missing-`last_updated` case; identical behavior on the happy path and the missing-`temperature_celsius` path.
- Does NOT include: changing the required-columns list, the dropna/sort behavior, `add_region_column`, or any other function; adding configuration.

## Acceptance Criteria
- `missing_last_updated_raises_project_error`: a CSV without `last_updated` raises `ValueError` matching "Missing required columns", not pandas' `parse_dates` message.
- `missing_temperature_raises_project_error`: a CSV without `temperature_celsius` still raises "Missing required columns".
- `happy_path_unchanged`: existing load/sort/dropna tests still pass (dates parsed to datetime, sorted ascending, null dates dropped).
- `existing_data_loader_tests_pass`: the current `tests/test_data_loader.py` suite passes.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_data_loader.py -q`. Deterministic, no randomness. pandas per `requirements.txt`, Python 3.10.

## Risks and Assumptions
- Assumption: `pd.to_datetime(df["last_updated"], errors="coerce")` reproduces the prior parse (it already ran on the line after `parse_dates`); both paths produced datetime, so dropping `parse_dates` and keeping `to_datetime` yields the same values.
- Low risk: a reorder only. The happy path is unchanged and the error contract is strengthened.
