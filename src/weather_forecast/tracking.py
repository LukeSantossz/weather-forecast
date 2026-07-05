"""MLflow experiment tracking for training runs (issue #17).

Logs params, per-model metrics, and an optional artifact to a local MLflow file
store (``mlruns/`` by default). MLflow 3.x puts the bare file store in
maintenance mode; we opt in via ``MLFLOW_ALLOW_FILE_STORE`` so the lightweight
local backend the issue asks for keeps working. Point ``tracking_uri`` at a
sqlite or remote URI (with full MLflow installed) to use the richer backends.

``mlflow`` is imported lazily inside the function so importing this module never
requires the ``mlops`` extra.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any


def _flatten_metrics(metrics: dict[str, dict[str, float]]) -> dict[str, float]:
    """Flatten ``{model: {metric: value}}`` to ``{"model.metric": value}``."""
    flat: dict[str, float] = {}
    for model_id, model_metrics in metrics.items():
        for name, value in model_metrics.items():
            flat[f"{model_id}.{name}"] = float(value)
    return flat


def log_training_run(
    params: dict[str, Any],
    metrics: dict[str, dict[str, float]],
    *,
    tracking_uri: str | None = None,
    experiment: str = "weather-forecast",
    run_name: str | None = None,
    artifact_path: str | Path | None = None,
) -> str:
    """Log a training run to MLflow and return its run id.

    Args:
        params: Flat run parameters (seed, windows, ...).
        metrics: Per-model metrics, flattened to ``"<model>.<metric>"`` keys.
        tracking_uri: MLflow tracking URI; defaults to the ambient ``mlruns/``.
        experiment: Experiment name to log under.
        run_name: Optional run name.
        artifact_path: Optional file or directory to log as run artifacts.
    """
    os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")
    import mlflow

    if tracking_uri is not None:
        mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(experiment)
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params(params)
        mlflow.log_metrics(_flatten_metrics(metrics))
        if artifact_path is not None:
            path = Path(artifact_path)
            if path.is_dir():
                mlflow.log_artifacts(str(path))
            else:
                mlflow.log_artifact(str(path))
        return run.info.run_id
