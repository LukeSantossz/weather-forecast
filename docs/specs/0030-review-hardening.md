# SPEC: fix(pipeline): review-driven correctness and robustness hardening

## Problem
A project review surfaced three correctness/robustness gaps:
1. `--seed` is largely cosmetic. `set_global_seed` seeds `random`/`numpy`, but LightGBM's `seed`, GradientBoosting's `random_state`, and the ensemble's validation GB use the hardcoded `42` from `models.py`; `run_forecast` never threads `config.seed` into the estimators, so changing `--seed` does not change what it appears to promise (the `set_global_seed` docstring even says estimators "receive an explicit random_state/seed at their call sites").
2. Split sizes are unguarded. `run_forecast`/`carve_validation_tail` accept non-positive or oversized `test_window_days`/`val_size`; e.g. `val_size=0` makes `X_train.iloc[:-0]` an empty training set, and misuse fails with cryptic downstream errors.
3. `POST /anomaly` scores each request batch against itself, so a single observation always yields `z=0` (never anomalous) — exactly what the README's own example sends.

## Design Decision
- **Seed**: thread `config.seed` into the estimators in `run_forecast` by passing `params={"seed": config.seed}` to `train_lightgbm` and `params={"random_state": config.seed}` to both `train_gradient_boosting` calls (test and validation). Estimator hyperparameter defaults in `models.py` stay `42`; the CLI seed now actually varies them.
- **Guards**: add a positive-and-bounded check at the top of `run_forecast` (raise `ValueError` if `test_window_days`/`val_size` are non-positive or if `test_window_days + val_size` leaves no training data), and a guard in `carve_validation_tail` (raise if `val_size` is not in `1..len-1`). Clear messages replace cryptic slicing failures.
- **Anomaly batch floor**: require a minimum batch on `AnomalyRequest.observations` (`min_length = MIN_ANOMALY_BATCH = 10`) so a single-row request returns HTTP 422 instead of a meaningless verdict, and document that `/anomaly` scores the batch relative to itself. Update the README example to send a batch.

## Alternatives Considered
- **Persist a reference distribution for `/anomaly`** (mu/sigma + a fitted IsolationForest) and load it at startup. Deferred: a larger design change; the minimum-batch floor plus explicit batch-relative documentation is the honest, bounded fix for this slice.
- **Validate window sizes in `PipelineConfig`.** Rejected: the bound depends on the runtime series length, so the check belongs in `run_forecast`, not the frozen config.

## Scope
- Includes: seed threading in `run_forecast`; guards in `run_forecast` and `carve_validation_tail`; `min_length` on `AnomalyRequest` + a `MIN_ANOMALY_BATCH` constant and docstring; README `/anomaly` example updated to a batch; tests for each.
- Does NOT include: threading the seed into every estimator hyperparameter dataclass, rolling-origin backtesting, or the persisted-reference `/anomaly` rework (separate future work).

## Acceptance Criteria
- `run_forecast_seed_changes_results`: `run_forecast` with two different seeds yields different LightGBM (and GradientBoosting) metrics; same seed still reproduces exactly.
- `run_forecast_rejects_invalid_windows`: `val_size=0` (and `test_window_days+val_size >= len`) raises `ValueError` with a clear message.
- `carve_validation_tail_guards_val_size`: `val_size <= 0` or `>= len` raises `ValueError`.
- `anomaly_rejects_tiny_batch`: `POST /anomaly` with fewer than `MIN_ANOMALY_BATCH` observations returns HTTP 422; a full batch still returns 200.
- Existing suite passes; `ruff`/`mypy` clean.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_train.py tests/test_models.py tests/test_api.py -q`. Seed-difference is deterministic given fixed seeds; guards are pure input validation.

## Risks and Assumptions
- Assumption: LightGBM/GB carry enough stochasticity (bagging/subsample 0.8) that two seeds diverge on the synthetic fixture; if a fixture were too small to diverge, the test uses the standard 100-point series that does.
- Low risk: additive validation and a threaded seed; the default seed (42) preserves existing reported metrics, so `web/public/data` numbers are unaffected.
