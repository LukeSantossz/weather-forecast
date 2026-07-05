# SPEC: feat(mlops): MLflow experiment tracking and Evidently drift monitoring

## Problem
Training metrics live only in stdout and notebook outputs; there is no run-to-run comparison, no param/metric/artifact lineage, and no monitoring of data drift over time. This is issue #17 (phase-4). With training centralized in `src` (#14) and artifacts persisted (#15), MLflow and Evidently attach cleanly and make model quality observable, a standard MLOps signal.

## Design Decision
Add two small, independently useful modules, each with its heavy dependency imported lazily inside the functions so importing the module never requires the dependency:

- `weather_forecast/tracking.py`: `log_training_run(params, metrics, *, tracking_uri=None, experiment="weather-forecast", run_name=None, artifact_path=None)` opens an MLflow run, logs the flat `params`, logs the nested per-model `metrics` flattened to `"<model>.<metric>"` keys, optionally logs an artifact directory/file, and returns the run id. It uses a local **file store** (`mlruns/` by default), opting in via `MLFLOW_ALLOW_FILE_STORE=true` because MLflow 3.x puts the bare file store in maintenance mode but still supports it (this is exactly the "local file backend" issue #17 asks for). The `train` CLI gains a `--track` flag (and `--tracking-uri`) that logs the run's config params and per-model metrics, plus the saved artifact when `--save` is also given.
- `weather_forecast/drift.py`: `data_drift_report(reference, current, *, numerical_columns=None, html_path=None)` builds an Evidently `Report([DataDriftPreset()])`, runs it over `Dataset.from_pandas(...)` reference vs current frames, optionally writes an HTML report, and returns a structured summary `{dataset_drift, drifted_columns, share, columns: {col: {p_value, drifted}}}` extracted from the report by matching the stable metric `type` fields (`DriftedColumnsCount`, `ValueDrift`), not display names. A `python -m weather_forecast.drift` CLI splits the daily series into an earlier reference window and a recent current window and reports whether the target drifted.

Add an `mlops` optional-dependency extra (`mlflow-skinny`, `evidently`). CI's `test` job installs `.[dev,serving,mlops]`; the `lint` job stays on `.[dev,serving]` since the lazy imports keep the modules importable and `mypy` uses `ignore_missing_imports`.

## Alternatives Considered
- **MLflow sqlite backend.** Rejected for the default: MLflow 3.x recommends sqlite, but the registry store needs SQLAlchemy which `mlflow-skinny` omits; the file store is lighter, matches the issue's "local file backend", and needs only the opt-in env var. `--tracking-uri` still lets a user point at sqlite with full MLflow.
- **Full `mlflow` instead of `mlflow-skinny`.** Rejected: skinny carries the tracking API and local file store (all this needs); the UI can be added later with `pip install mlflow`, which reads the same `mlruns/`.
- **Always-on tracking in the CLI.** Rejected: a `--track` flag keeps default runs and the existing tests free of the MLflow dependency and side effects; tracking is opt-in per run.
- **Evidently legacy `metrics`/`Report` API.** Rejected: pinned Evidently 0.7.x uses the `evidently.Report` + `presets.DataDriftPreset` + `Dataset` API, which is what we target.

## Scope
- Includes:
  - `weather_forecast/tracking.py` (`log_training_run`) and `weather_forecast/drift.py` (`data_drift_report` + a `__main__` CLI).
  - `train` CLI: `--track` and `--tracking-uri` flags.
  - `mlops` extra (`mlflow-skinny`, `evidently`); CI `test` job installs it.
  - Unit tests for tracking (params/metrics/artifact recorded, read back via `MlflowClient`) and drift (drift flagged on a shifted distribution, not flagged on an identical one, HTML written).
  - README "Experiment tracking & drift" subsection (how to enable, where `mlruns/` lives, how to view with `mlflow ui`, how to run the drift report).
  - `mlruns/` and `reports/*.html` covered by `.gitignore`.
- Does NOT include:
  - A hosted tracking server, model registry promotion, or scheduled/automated drift jobs (on-demand CLI only).
  - Prediction-drift monitoring beyond input-data drift (target/feature drift only for this slice).
  - Wiring tracking into the serving API (#16).

## Acceptance Criteria
- `log_training_run_records_params_metrics_artifact`: after a call, `MlflowClient` reads back the params, the flattened `"<model>.<metric>"` metrics, and the logged artifact for the created run.
- `train_track_creates_run`: `train --track --tracking-uri <tmp>` creates exactly one MLflow run carrying the config params and per-model metrics.
- `drift_flags_shifted_distribution`: `data_drift_report` on a reference vs a mean-shifted current frame reports `dataset_drift=True` with at least one drifted column.
- `drift_absent_on_identical_distribution`: identical reference/current reports `dataset_drift=False` (zero drifted share).
- `drift_report_writes_html`: passing `html_path` writes a non-empty HTML file.
- Existing suite passes; `ruff`/`mypy` clean; README documents setup and how to view reports.

## Reproducibility
`pip install -e .[dev,serving,mlops]` then `pytest tests/test_tracking.py tests/test_drift.py -q`. Tests use `pytest.importorskip` for `mlflow`/`evidently` and write to `tmp_path` (isolated `mlruns/` and HTML). MLflow file store is deterministic; Evidently's K-S drift test is deterministic given seeded frames. Python 3.10/3.11.

## Risks and Assumptions
- Assumption: the local MLflow file store remains supported in 3.x behind `MLFLOW_ALLOW_FILE_STORE=true`; if a future release removes it, switch the default to sqlite with full MLflow (the `--tracking-uri` seam already allows this).
- Assumption: Evidently's `.dict()` exposes `DriftedColumnsCount` and `ValueDrift` entries with stable `config.type` values; extraction matches on those, not on display strings.
- Medium risk: heavy new deps (`evidently` pulls a large tree) increase CI `test` time. Mitigated by keeping them in an extra and off the `lint` job, and by lazy imports so the core install and other modules are unaffected.
- Low risk otherwise: both modules are additive and side-effect-free unless explicitly invoked.
