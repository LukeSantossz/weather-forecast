# SPEC: refactor(notebooks): put notebook 06 on the package so the numbers have one source

## Problem

Notebook 06 produces the forecast numbers the dashboard publishes, but it re-declares the model
hyperparameters, the split sizes, the metric formulas and the ensembling arithmetic inline instead
of calling the package, so `models.py` and the notebook can drift apart without any test noticing.

## Design Decision

Replace every inline fit, literal and formula in notebook 06 with the corresponding
`weather_forecast` function that already exists and is already tested: `fit_arima`, `fit_sarima`,
`forecast_steps`, `carve_validation_tail`, `train_lightgbm`, `train_gradient_boosting`,
`compute_metrics`, `rmse`, `inverse_rmse_weights`, `simple_average` and `weighted_ensemble`, with
the window sizes and the seed read from `PipelineConfig`. The notebook keeps its structure, its
prints, its diagnostics, its plots and its data-contract export; it stops owning the numbers.

No package code changes. Nothing new is added to `weather_forecast`, because every function the
notebook needs is already exported and covered by `tests/test_models.py` and
`tests/test_evaluation.py`.

## Alternatives Considered

- **Have the notebook call `run_forecast` directly.** Rejected: `run_forecast` returns metrics
  only. The notebook also needs the per-model test predictions and the ensemble weights for its
  plots and for `build_forecast_real`/`build_metrics_real`. Delegating to it would mean widening
  the package's public return type, a larger and riskier change than reusing the functions
  `run_forecast` itself composes.
- **Add a `ForecastRun` result object to the package and return predictions and weights from it.**
  Rejected for now: it is the better long-term shape, but it changes a public signature and the
  training CLI for a problem that reusing the existing functions already solves.
- **Delete the duplicated cells and generate the contract from the CLI instead.** Rejected: the
  notebook is the analytical narrative. Removing the stationarity analysis, the model summaries
  and the comparison plots to save duplication would trade an explanation for a script.
- **Leave it and rely on review.** Rejected: this is exactly the failure review does not catch,
  since both copies are individually correct and only disagree after someone edits one.

## Scope

- **Includes:** `notebooks/06_advanced_forecasting.ipynb`, this spec, and the two README lines
  that recorded the duplication as a limitation and as pending work.
- **Does NOT include:**
  - Any change to `src/weather_forecast/`, the tests, or the CI.
  - Any change to the published numbers or to the committed data contract under
    `web/public/data/`.
  - The same treatment for notebooks 04 and 07, which already call the package for their
    detectors and their export.
  - Regenerating the contract from the real dataset.

## Acceptance Criteria

- `notebook_executes_end_to_end`: `jupyter nbconvert --execute` runs notebook 06 to completion
  with exit code 0.
- `notebook_matches_the_cli`: on the same input series, every model row the notebook writes to
  `metrics.json` equals `run_forecast`'s value for that model at the published precision.
- `contract_is_unchanged`: the `metrics.json` and `forecast.json` the rewired notebook writes are
  identical to the ones the previous version writes from the same input, ignoring `generated_at`.
- `no_model_literals_left`: the notebook contains no ARIMA order, SARIMA order, LightGBM parameter
  dict, GradientBoosting constructor or hand-written RMSE, MAE, MAPE or inverse-RMSE expression.
- `package_untouched`: `git diff` shows no change under `src/`, and the Python suite still passes.

## Reproducibility

The real dataset is not required. Build a synthetic `data/raw/GlobalWeatherRepository.csv` with
`last_updated` and `temperature_celsius` over at least 400 days in an isolated copy of the
repository, then, from that copy:

```
cd notebooks
MPLBACKEND=Agg python -m nbconvert --to notebook --execute --output executed_06.ipynb \
    06_advanced_forecasting.ipynb
```

Compare the resulting `web/public/data/metrics.json` against
`run_forecast(daily_global_mean(project_root))` for the same copy, and against the same file
produced by the previous version of the notebook. Run the comparison in an isolated copy, never in
a working tree that holds the real contract: cell 32 writes `web/public/data/` in place.

## Risks and Assumptions

- Assumption: the package functions are numerically identical to the code they replace. They were
  extracted from this notebook under issue #14 with its exact hyperparameters, and the
  contract-comparison criterion above checks it rather than trusting it.
- Assumption: `forecast_steps` returning a numpy array instead of the pandas Series the notebook
  used is safe for the plots and the export, which only iterate and index.
- Risk: the notebook cannot be executed against the real dataset here, so the verification runs on
  a synthetic series. Mitigation: the synthetic run exercises every rewired cell and the full
  export path, and the comparison is made against the previous version on the same input, so any
  behavioral difference would show regardless of which data is used.
