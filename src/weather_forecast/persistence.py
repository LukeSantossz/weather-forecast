"""Model artifact persistence and versioning.

Layout: ``<models_dir>/<name>/<version>/`` holds ``model.joblib`` (the fitted
model, or a bundle dict that also carries preprocessing artifacts such as the
scaler and encoded columns from #8/#9) and ``metadata.json``. The metadata holds
the caller's fields (metrics, training window, hyperparameters, ...) augmented
with ``name``, ``version``, and captured ``dependency_versions`` for lineage.
Versions are filesystem-safe UTC timestamps by default (sortable, so the latest
is the max) or a caller-supplied string.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version
from pathlib import Path
from typing import Any

import joblib

_TRACKED_DEPS = ("numpy", "pandas", "scikit-learn", "lightgbm", "statsmodels")

_MODEL_FILE = "model.joblib"
_META_FILE = "metadata.json"


def _timestamp_version() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _dependency_versions() -> dict[str, str]:
    out: dict[str, str] = {}
    for dep in _TRACKED_DEPS:
        try:
            out[dep] = _pkg_version(dep)
        except PackageNotFoundError:
            out[dep] = "unknown"
    return out


def save_artifact(
    payload: Any,
    metadata: dict,
    *,
    models_dir: Any,
    name: str,
    version: str | None = None,
) -> Path:
    """Serialize ``payload`` and write its metadata under a versioned directory.

    Returns:
        The version directory the artifact was written to.
    """
    version = version or _timestamp_version()
    dest = Path(models_dir) / name / version
    dest.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, dest / _MODEL_FILE)
    meta = {
        **dict(metadata),
        "name": name,
        "version": version,
        "dependency_versions": _dependency_versions(),
    }
    (dest / _META_FILE).write_text(json.dumps(meta, indent=2, default=str) + "\n")
    return dest


def list_versions(models_dir: Any, name: str) -> list[str]:
    """Return the sorted version directory names for ``name`` (empty if none)."""
    base = Path(models_dir) / name
    if not base.exists():
        return []
    return sorted(p.name for p in base.iterdir() if p.is_dir())


def latest_version(models_dir: Any, name: str) -> str:
    """Return the newest version for ``name``.

    Raises:
        FileNotFoundError: If ``name`` has no versions.
    """
    versions = list_versions(models_dir, name)
    if not versions:
        raise FileNotFoundError(f"No versions for model {name!r} under {models_dir}")
    return versions[-1]


def load_artifact(models_dir: Any, name: str, *, version: str = "latest") -> tuple[Any, dict]:
    """Load a persisted ``(payload, metadata)`` for ``name``.

    Raises:
        FileNotFoundError: If the model/version does not exist.
    """
    if version == "latest":
        version = latest_version(models_dir, name)
    src = Path(models_dir) / name / version
    model_path = src / _MODEL_FILE
    if not model_path.exists():
        raise FileNotFoundError(f"No artifact at {src}")
    payload = joblib.load(model_path)
    meta = json.loads((src / _META_FILE).read_text())
    return payload, meta
