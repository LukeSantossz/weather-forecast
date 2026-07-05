# SPEC: feat(features): extract time-series feature engineering

## Problem
The forecasting feature engineering (lag, rolling, calendar, and cyclical features) lives only inside `notebooks/06`'s `create_features`, so it cannot be imported, tested, or reused. This is sub-module 2 of the #14 pipeline-extraction epic.

## Design Decision
Extract the notebook's `create_features` verbatim into `weather_forecast/features.py` as a pure `create_features(df, *, lags, rolling_windows)` that takes a daily `(ds, y)` frame and returns a `ds`-indexed feature frame: lag features, rolling mean/std (computed on `shift(1)` so no target leakage), calendar features (day-of-week, month, day-of-year, week-of-year), and cyclical sin/cos encodings for month and day-of-week. Lags and rolling windows become parameters with the notebook's values as defaults, so they are configurable rather than hardcoded.

## Alternatives Considered
- **Bake `dropna` into `create_features`.** Rejected: the transform should be pure and leave row-dropping to the caller (as the notebook does), so callers can choose how to handle the leading NaNs.
- **Move lags/windows into `PipelineConfig`.** Rejected here: these are feature-specific, not cross-cutting; function parameters with defaults keep them local and testable. The CLI sub-module can pass config-derived values later.
- **Reimplement with a different feature set.** Rejected: fidelity to the notebook keeps the merged metrics reproducible; behavior-changing feature work is out of scope.

## Scope
- Includes:
  - `weather_forecast/features.py`: `create_features(df, *, lags=(1,2,3,7,14,21), rolling_windows=(7,14,30))` returning the `ds`-indexed frame with `y` plus the engineered columns; module constants `DEFAULT_LAGS`, `DEFAULT_ROLLING_WINDOWS`.
  - Unit tests.
- Does NOT include:
  - Rewiring `notebooks/06` to call it (the final #14 sub-module thins the notebooks).
  - Model training, splitting, or evaluation (later sub-modules).

## Acceptance Criteria
- `create_features_produces_expected_columns`: output contains `lag_1..lag_21`, `rolling_mean_/std_{7,14,30}`, `dayofweek`, `month`, `dayofyear`, `weekofyear`, `month_sin/cos`, `dow_sin/cos`, and keeps `y`.
- `lag_k_equals_target_shifted_by_k`: `lag_7` equals `y.shift(7)`.
- `rolling_uses_only_past_values`: `rolling_mean_7` at row *i* excludes `y[i]` (uses `shift(1)`), so the first non-NaN appears no earlier than row 8.
- `cyclical_encodings_are_bounded`: `month_sin/cos` and `dow_sin/cos` lie in [-1, 1].
- `lags_and_windows_are_overridable`: passing `lags=(1,)`, `rolling_windows=(3,)` yields exactly `lag_1`, `rolling_mean_3`, `rolling_std_3` (and no others).
- Existing suite still passes; `ruff`/`mypy` clean.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_features.py -q`. Deterministic (pure pandas/numpy transforms). Python 3.10.

## Risks and Assumptions
- Assumption: input is a daily frame with `ds` (datetime) and `y` columns, as produced upstream; a missing column surfaces as a `KeyError` from pandas (a boundary validator is out of scope here).
- Low risk: a faithful extraction with no consumer yet; notebook behavior is unchanged until the rewiring sub-module.
