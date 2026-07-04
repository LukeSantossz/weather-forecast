# SPEC: feat(dashboard): export real model output to the data contract

## Problem
The dashboard only ships a `data_status: "sample"` snapshot; its `metrics.json` still marks LightGBM, GradientBoosting, and both ensembles as `pending_rerun (#20)` and shows stale ARIMA/SARIMA figures, even though #20 is merged with verified leakage-free numbers, so a viewer sees a "pending" caveat for a fixed bug.

## Design Decision
Add a sanctioned real-data path to `src/dashboard_export.py`: pure `build_*_real(...)` constructors that take the values the notebooks already compute, schema-validate them, and emit sections with `data_status: "real"`, plus `write_real_contract(...)` that writes all five files together. Wire a small export cell at the end of notebooks 06 (forecast + metrics), 04 (anomalies + meta), and 07 (shap) that passes their computed arrays to the builders and writes into `web/public/data/`. Regenerate and commit the real contract by running those notebooks with `data/raw/` present. This keeps the modeling in the notebooks (the source of truth per EVO-1(b)), keeps the export logic pure and unit-tested, and reuses the UI's existing `data_status: "real"` rendering (the `DataStatusBanner` already handles it) with no UI change.

## Alternatives Considered
- **Reproduce all modeling in a standalone `src` driver that re-runs the models and writes the contract.** Rejected here: it duplicates the ARIMA/SARIMA/LightGBM/GB/ensemble, anomaly, and SHAP logic that lives in the notebooks, and that extraction is exactly issue #14 (pipeline into `src` + CLI); doing it now conflates two epics.
- **Relax the existing `_sample_only` guard so the sample builders can emit "real".** Rejected: the guard exists to stop synthetic sample values being labelled real. Separate `build_*_real` functions keep that safety and make the real path explicit.
- **Only refresh `metrics.json` to real, leave forecast/anomalies/shap sample.** Rejected: mixed real/sample sections misrepresent the dashboard; wiring all four is the coherent state the owner asked for.

## Scope
- Includes:
  - `src/dashboard_export.py`: `build_meta_real`, `build_forecast_real`, `build_metrics_real`, `build_anomalies_real`, `build_shap_real` (pure, schema-validated, `data_status="real"`), and `write_real_contract(out_dir, *, meta, forecast, metrics, anomalies, shap)`.
  - Export cells at the end of notebooks 06, 04, and 07 that assemble the real inputs and write the corresponding sections to `web/public/data/`.
  - Regenerated, committed `web/public/data/{meta,forecast,metrics,anomalies,shap}.json` with `data_status: "real"`, a real `generated_at`, and the real `repo_commit`.
  - Unit tests for the real builders and `write_real_contract`.
- Does NOT include:
  - Extracting the modeling pipeline into `src` or a CLI (#14).
  - Any live/scheduled refresh or CI regeneration of the contract.
  - Any change to the web UI components, the sample builders, or the JSON schemas.
  - Changing model hyperparameters or the notebooks' modeling logic (only appending an export cell).

## Acceptance Criteria
- `build_metrics_real_reflects_corrected_numbers`: `build_metrics_real` marks every model `status="final"` (no `pending_rerun`), with GradientBoosting 0.27, LightGBM 0.32, ARIMA 0.73, SARIMA 0.80, Prophet 0.77, Ensemble (weighted) 0.35, Ensemble (simple) 0.47 RMSE and the validation-holdout weights (ARIMA 0.12, SARIMA 0.12, LightGBM 0.41, GB 0.35), and validates against `metrics.schema.json`.
- `each_real_builder_is_schema_valid_and_marked_real`: `build_meta_real`, `build_forecast_real`, `build_anomalies_real`, `build_shap_real` return `data_status="real"` and pass their schema.
- `write_real_contract_writes_five_real_files`: writes `meta/forecast/metrics/anomalies/shap.json`, each schema-valid with `data_status="real"`.
- `committed_metrics_has_no_pending_rerun`: the regenerated `web/public/data/metrics.json` contains no `pending_rerun` status and no `#20` caveat.
- `web_build_succeeds_with_real_data`: `next build` in `web/` succeeds against the regenerated contract.
- `existing_dashboard_export_tests_pass`: the sample-builder suite (`tests/test_dashboard_export.py`) still passes.

## Reproducibility
With `data/raw/GlobalWeatherRepository.csv` present, run notebooks 06, 04, 07 (for example via `jupyter nbconvert --to notebook --execute`), each writing its section into `web/public/data/`; then `cd web && npm run build`. Builder unit tests: `.venv-run/Scripts/python.exe -m pytest tests/test_dashboard_export.py -q`. Real `generated_at` and `repo_commit` are passed in at export time (not fixed), so the committed contract is a point-in-time snapshot, like the README's re-run numbers.

## Risks and Assumptions
- Assumption: the raw dataset is available locally to regenerate the contract; the committed JSON is a manual snapshot, not CI-generated. Invalidated if the numbers must auto-refresh (out of scope; that is a later live-data phase).
- Assumption: the notebooks' computed structures (daily history/actual, per-model predictions, anomaly per-record fields, SHAP values over the 1000-row sample) map cleanly onto the existing schemas; confirmed by inspection of notebooks 04/06/07.
- Assumption: appending an export cell to a notebook does not alter its modeling; the cells only read already-computed variables and write JSON.
- Medium risk: three notebooks must run cleanly with data present to produce a full real contract; a partial run leaves a mixed real/sample contract. The export cell writes only after its section's computation succeeds, and `write_real_contract` refuses a partial set.
