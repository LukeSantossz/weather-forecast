# SPEC: feat(config): pipeline config, global seed, and structured logging

## Problem
Pipeline hyperparameters (IQR 1.5, Z-threshold 3.0, contamination 0.02, split windows, seed) are hardcoded across notebooks and there is no shared config, seed control, or structured logging, so runs are not centrally configurable or reproducible. This is sub-module 1 of the #14 pipeline-extraction epic.

## Design Decision
Add `weather_forecast/config.py` with a frozen `PipelineConfig` dataclass holding the cross-cutting hyperparameters and a `seed`, a `from_dict` override constructor, and a `set_global_seed(seed)` that seeds `random` and `numpy`. Add `weather_forecast/logging_setup.py` with `configure_logging(level)` and `get_logger(name)`. A dependency-free frozen dataclass is chosen over `pydantic-settings` to avoid a new dependency for a small, closed set of fields; `from_dict` covers override needs (YAML/env wiring can layer on later without changing the dataclass).

## Alternatives Considered
- **pydantic-settings / a YAML file now.** Rejected for this sub-module: adds a dependency and env/file plumbing for a handful of fields; the frozen dataclass with `from_dict` is enough and keeps the core install lean. Revisit if config grows env-driven.
- **A plain module-level constants file.** Rejected: not overridable per-run and not reproducible-seed-aware; a dataclass gives immutability and typed override.
- **Name the logging module `logging.py`.** Rejected: too easily confused with the stdlib `logging`; `logging_setup.py` is unambiguous.

## Scope
- Includes:
  - `weather_forecast/config.py`: frozen `PipelineConfig` (fields: `seed=42`, `iqr_multiplier=1.5`, `z_threshold=3.0`, `contamination=0.02`, `test_window_days=30`, `val_size=30`, `max_cardinality=50`), `PipelineConfig.from_dict(overrides)`, and `set_global_seed(seed)`.
  - `weather_forecast/logging_setup.py`: `configure_logging(level="INFO")` and `get_logger(name)`.
  - Unit tests for both.
- Does NOT include:
  - Consuming the config in features/models/anomaly/evaluation (later #14 sub-modules) or rewiring notebooks.
  - Model-specific hyperparameters (they live with the `models` sub-module).
  - YAML/env loading, a CLI, or file-based log sinks.

## Acceptance Criteria
- `pipeline_config_has_documented_defaults`: `PipelineConfig()` exposes the default hyperparameters (seed 42, iqr 1.5, z 3.0, contamination 0.02, test/val 30, max_cardinality 50).
- `from_dict_overrides_only_given_fields`: `PipelineConfig.from_dict({"seed": 7})` sets `seed=7` and leaves the rest at defaults; an unknown key raises.
- `config_is_immutable`: assigning to a `PipelineConfig` field raises `FrozenInstanceError`.
- `set_global_seed_makes_numpy_reproducible`: seeding then sampling twice with the same seed yields identical arrays.
- `get_logger_returns_named_logger` and `configure_logging_sets_level`: the logger is named and the package logger level is set.
- Existing suite still passes; `ruff`/`mypy` clean.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_config.py tests/test_logging_setup.py -q`. Deterministic; `set_global_seed` is the reproducibility primitive the later CLI relies on. Python 3.10.

## Risks and Assumptions
- Assumption: seeding `random` and `numpy` covers the pipeline's randomness surfaces (sklearn/LightGBM take explicit `random_state`/`seed` at call sites in later sub-modules); Prophet's remaining nondeterminism is handled where Prophet is wired.
- Low risk: additive modules with no consumer yet; nothing existing changes behavior.
