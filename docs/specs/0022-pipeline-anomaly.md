# SPEC: feat(anomaly): extract Z-score and Isolation Forest detectors

## Problem
Anomaly detection (Z-score on temperature and an Isolation Forest over weather features) lives only in `notebooks/04`, so it cannot be imported, tested, or driven by the CLI. This is sub-module 4 of the #14 epic.

## Design Decision
Extract into `weather_forecast/anomaly.py` two pure detectors and an overlap helper, faithful to notebook 04: `zscore_anomalies(values, *, threshold)` returns the z-scores (population std, `ddof=0`) and a boolean mask for `|z| > threshold`; `isolation_forest_anomalies(X, *, contamination, n_estimators, seed)` median-fills, standardizes, and fits an `IsolationForest`, returning an `anomaly` boolean mask and the `score_samples` values aligned to `X`'s index; `overlap_count(mask_a, mask_b)` counts where both are true. Thresholds/params are function arguments defaulting to the notebook's values (Z 3.0, contamination 0.02, 200 trees, seed 42).

## Alternatives Considered
- **Return raw numpy arrays.** Rejected: index-aligned `pd.Series` lets callers join detections back onto the source frame (the notebook and the dashboard export both need per-row alignment).
- **Fold feature selection/fill into the detector's signature via column names.** Rejected: the detector takes an already-selected feature frame `X`; column selection is the caller's concern (keeps the detector reusable).
- **Move thresholds into `PipelineConfig` now.** The config already carries `z_threshold` and `contamination`; the CLI sub-module will pass them in. Here they stay as defaulted parameters so the detectors are usable standalone.

## Scope
- Includes:
  - `weather_forecast/anomaly.py`: `zscore_anomalies`, `isolation_forest_anomalies`, `overlap_count`, and a `DEFAULT_IF_FEATURES` constant.
  - Unit tests.
- Does NOT include:
  - Feature-column selection/validation, plotting, or the dashboard export (already wired in #0015); metrics/CLI (sub-module 5); notebook rewiring.

## Acceptance Criteria
- `zscore_flags_outliers`: a series with one extreme value flags exactly that value at threshold 3.0; the z-scores have ~zero mean and unit population std.
- `zscore_threshold_is_overridable`: a lower threshold flags more points.
- `isolation_forest_returns_aligned_mask_and_scores`: on synthetic data with planted outliers, the mask and scores are `pd.Series` indexed like `X`, with length `len(X)` and at least one anomaly; higher `contamination` flags at least as many.
- `isolation_forest_is_seeded`: two runs with the same seed produce identical masks.
- `overlap_count_counts_both`: returns the number of rows where both masks are true.
- Existing suite passes; `ruff`/`mypy` clean.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_anomaly.py -q`. `IsolationForest` is seeded (`random_state=42`); Z-score is deterministic. Python 3.10; scikit-learn 1.7.

## Risks and Assumptions
- Assumption: the caller passes a numeric feature frame (median-fill handles residual NaNs); non-numeric columns are the caller's responsibility.
- Low risk: faithful extraction, additive, no consumer changed yet.
