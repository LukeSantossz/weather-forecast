# SPEC: feat(models): extract forecasting models, split, and ensembling

## Problem
The forecasting models (ARIMA, SARIMA, LightGBM, GradientBoosting), the leakage-free chronological split, and the inverse-RMSE ensemble live only in `notebooks/06`, so they cannot be imported, tested, or driven by a CLI. This is sub-module 3 of the #14 epic.

## Design Decision
Extract into `weather_forecast/models.py` the notebook's model trainers and the split/ensemble helpers as pure, importable functions with the notebook's exact hyperparameters as defaults: `chronological_split`, `carve_validation_tail`, `train_lightgbm` (early stopping on a validation tail), `train_gradient_boosting`, `fit_arima`, `fit_sarima`, `forecast_steps`, `inverse_rmse_weights`, `weighted_ensemble`, and `simple_average`. The leakage-free discipline from #20 is preserved structurally: the validation tail is carved from the training window and the ensemble weights come from validation RMSEs. Prophet stays out of scope: it is a standalone baseline in notebook 05, not part of the notebook-06 ensemble, and its Stan fit is disproportionately slow for unit tests.

## Alternatives Considered
- **One `train_all()` that fits every model and returns predictions.** Rejected for this sub-module: a single fat function is hard to test and reuse; per-model functions plus small split/ensemble helpers compose better and unit-test cleanly. The orchestration belongs to the CLI sub-module.
- **Include Prophet here.** Rejected: Prophet is a separate baseline (notebook 05), not in the 06 ensemble; wiring it and its slow probabilistic fit into these unit tests is disproportionate. Tracked for the evaluation/CLI sub-module or a follow-up.
- **Move model hyperparameters into `PipelineConfig`.** Rejected: they are model-specific; module-level default dicts (overridable per call) keep them local, matching the features sub-module's pattern.

## Scope
- Includes:
  - `weather_forecast/models.py`: `chronological_split(data, cutoff)`, `carve_validation_tail(X_train, y_train, val_size)`, `train_lightgbm(X_tr, y_tr, X_val, y_val, *, params, num_boost_round, stopping_rounds)`, `train_gradient_boosting(X, y, *, params)`, `fit_arima(series, *, order)`, `fit_sarima(series, *, order, seasonal_order)`, `forecast_steps(fit, steps)`, `inverse_rmse_weights(rmses)`, `weighted_ensemble(predictions, weights)`, `simple_average(predictions)`, plus default-hyperparameter constants matching notebook 06.
  - Unit tests: pure helpers (split, carve, weights, ensembles) exhaustively; trainers as fast smoke tests on tiny synthetic data.
- Does NOT include:
  - Prophet; anomaly detection (#14 sub-module 4); metrics/CLI (#14 sub-module 5); rewiring notebooks.

## Acceptance Criteria
- `chronological_split_is_time_ordered`: with a datetime-indexed frame and a cutoff, `train` holds rows `<= cutoff` and `test` rows `> cutoff`, no shuffle, disjoint and exhaustive.
- `carve_validation_tail_takes_last_val_size`: `X_val`/`y_val` are the last `val_size` rows; `X_tr`/`y_tr` the rest.
- `inverse_rmse_weights_are_normalized_and_inverse`: weights sum to 1 and the model with the smaller RMSE gets the larger weight.
- `weighted_ensemble_matches_manual` and `simple_average_matches_mean`: both reproduce the manual computation.
- `train_lightgbm_fits_and_predicts` / `train_gradient_boosting_fits_and_predicts` / `fit_arima_forecasts` / `fit_sarima_forecasts`: each returns a usable model whose prediction/forecast has the expected length on tiny synthetic data (smoke).
- Existing suite passes; `ruff`/`mypy` clean.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_models.py -q`. LightGBM and GradientBoosting take the seeded params (`seed`/`random_state=42`); ARIMA/SARIMA are deterministic. Smoke tests use tiny synthetic series so the suite stays fast. Python 3.10; lightgbm 4.6, statsmodels 0.14, scikit-learn 1.7.

## Risks and Assumptions
- Assumption: preserving the notebook's exact hyperparameters and the leakage-free split keeps the extracted functions consistent with the merged, verified metrics; the CLI sub-module will assert end-to-end reproduction.
- Assumption: SARIMA's seasonal fit on a tiny synthetic series converges well enough for a shape smoke test (no metric assertion here).
- Medium risk: statsmodels/LightGBM version drift could change fits; pinned versions (from #10/#12) mitigate. No behavior change to notebooks yet.
