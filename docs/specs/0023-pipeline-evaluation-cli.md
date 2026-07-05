# SPEC: feat(cli): forecast evaluation metrics and a training CLI

## Problem
Evaluation metrics (RMSE/MAE/MAPE) and the end-to-end forecast orchestration live only in `notebooks/06`, so training cannot run outside Jupyter and there is no reproducible CLI. This is sub-module 5 (final) of the #14 epic, composing the earlier `config`, `features`, and `models` modules.

## Design Decision
Add `weather_forecast/evaluation.py` with `rmse`, `mae`, `mape` (zero-masked, as in the notebook), and `compute_metrics` returning a `{rmse_c, mae_c, mape_pct}` dict. Add `weather_forecast/train.py` with `run_forecast(daily, *, config)` that composes `set_global_seed`, `create_features`, the chronological split, the four model trainers, and the ensembles into a `{model_id: metrics}` result (leakage-free: the LightGBM/ensemble validation comes from a tail carved out of the training window), and a `main(argv)` CLI (`python -m weather_forecast.train`) that loads the raw data, runs the forecast under the config seed, and prints the metrics table.

## Alternatives Considered
- **Compute weighted-ensemble weights from the test-window RMSEs.** Rejected: that is exactly the #20 leakage; weights come from an out-of-sample validation carve, applied to the untouched test predictions.
- **A metrics class / sklearn scorer wrapper.** Rejected: three small pure functions plus a dict are enough and match the notebook.
- **Argparse subcommands / a config file argument now.** Rejected as premature; `main` takes `--project-root` and optional seed, reading defaults from `PipelineConfig`. Richer config wiring can follow.

## Scope
- Includes:
  - `weather_forecast/evaluation.py`: `rmse`, `mae`, `mape`, `compute_metrics`.
  - `weather_forecast/train.py`: `run_forecast(daily, *, config)` (per-model + simple/weighted ensemble metrics) and `main(argv=None)` exposed as `python -m weather_forecast.train`.
  - Unit tests for metrics and orchestration (structure + reproducibility on synthetic data), and a CLI smoke test on a tiny synthetic CSV.
- Does NOT include:
  - Rewiring the notebooks to call these modules (a mechanical follow-up; the notebooks keep working meanwhile).
  - Prophet, persistence (#15), or serving (#16).

## Acceptance Criteria
- `metrics_match_manual`: `rmse`/`mae`/`mape`/`compute_metrics` reproduce hand-computed values; `mape` ignores zero-truth entries.
- `run_forecast_reports_all_models`: on a synthetic daily series it returns metrics dicts for `arima`, `sarima`, `lightgbm`, `gradientboosting`, `ensemble_simple`, and `ensemble_weighted`.
- `run_forecast_is_reproducible`: two runs with the same seed/config produce identical metrics (the global-seed reproducibility criterion of #14).
- `cli_runs_end_to_end_and_reports_metrics`: `main(["--project-root", <tmp>])` on a tiny synthetic `data/raw` CSV exits 0 and prints a metrics line per model.
- Existing suite passes; `ruff`/`mypy` clean.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_evaluation.py tests/test_train.py -q`. `run_forecast` calls `set_global_seed(config.seed)`; LightGBM/GradientBoosting carry seeded params and ARIMA/SARIMA are deterministic, so repeated runs match exactly. Synthetic series keep the tests fast. Python 3.10.

## Risks and Assumptions
- Assumption: a ~120-point synthetic daily series with a weekly component lets ARIMA/SARIMA and the tree models fit for a structural/reproducibility check (no metric-value assertion against the real data here; the committed dashboard/README numbers remain the real-data reference).
- Medium risk: `run_forecast` re-implements notebook 06's orchestration; fidelity is covered by reusing the already-tested `features`/`models` functions and the leakage-free split.
- The notebook-thinning acceptance item is deferred to a follow-up so this PR stays reviewable and does not require re-running notebooks.
