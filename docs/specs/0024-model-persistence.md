# SPEC: feat(models): persist and version model artifacts with metadata

## Problem
Trained models are discarded after every run; nothing is serialized, so predictions cannot be served without retraining, and there is no versioning or lineage. This is issue #15 (phase-2), building on the #14 training pipeline.

## Design Decision
Add `weather_forecast/persistence.py` with `save_artifact(payload, metadata, *, models_dir, name, version=None)` and `load_artifact(models_dir, name, *, version="latest")`, plus `list_versions` and `latest_version`. Artifacts live under `models_dir/<name>/<version>/`, holding `model.joblib` (the fitted model or a bundle dict that also carries the preprocessing scaler/columns from #8/#9) and `metadata.json` (name, version, plus caller metadata such as metrics, training window, and hyperparameters, augmented with captured dependency versions). Versions are ISO-8601 timestamps by default (sortable, so "latest" is the max) or a caller-supplied string. `models/` is added to `.gitignore`. `joblib` is declared as a core dependency.

## Alternatives Considered
- **`pickle` directly.** Rejected: `joblib` is the scikit-learn-recommended serializer (efficient for numpy-heavy estimators) and is already an sklearn transitive dependency.
- **A `latest` symlink or pointer file.** Rejected: timestamp-named version directories sort chronologically, so `latest` is resolvable without an extra mutable pointer to keep consistent.
- **A single flat file per model.** Rejected: a per-version directory keeps the model and its metadata together and supports rollback to a pinned version.

## Scope
- Includes:
  - `weather_forecast/persistence.py`: `save_artifact`, `load_artifact`, `list_versions`, `latest_version`, and a dependency-version capture helper.
  - `joblib` added to `[project.dependencies]`; `models/` added to `.gitignore`.
  - Unit tests.
  - A short "Model artifacts" note documenting the layout and metadata fields in the module docstring.
- Does NOT include:
  - Wiring the training CLI (#14) to persist by default, or an inference/serving layer (#16) that loads artifacts (this module is the mechanism; consumers come later).
  - A remote/registry backend (MLflow is #17).

## Acceptance Criteria
- `save_artifact_writes_model_and_metadata`: saving creates `model.joblib` and `metadata.json` under `<models_dir>/<name>/<version>/`, and the metadata contains the caller fields plus `name`, `version`, and `dependency_versions`.
- `load_artifact_round_trips_predictions`: a fitted estimator saved then loaded reproduces the original's predictions exactly.
- `versions_are_listed_and_latest_resolves`: `list_versions` returns them sorted and `latest_version`/`load_artifact(version="latest")` resolve the newest.
- `load_missing_raises`: loading an unknown name/version raises `FileNotFoundError`.
- `models_dir_is_gitignored`: `.gitignore` ignores `models/`.
- Existing suite passes; `ruff`/`mypy` clean.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_persistence.py -q`. Tests pass explicit `version` strings to stay deterministic (the default timestamp version uses the wall clock, which is exercised only via an explicit-version path in tests). `joblib` round-trips are deterministic. Python 3.10.

## Risks and Assumptions
- Assumption: artifacts are loaded by the same major dependency versions they were saved under; `metadata.json` records the versions so a mismatch is detectable. `joblib` cross-version loading is otherwise the caller's risk.
- Low risk: additive module and a `.gitignore` line; no existing behavior changes, and no consumer is wired yet.
