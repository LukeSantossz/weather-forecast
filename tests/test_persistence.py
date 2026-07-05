"""Unit tests for weather_forecast.persistence."""

import json
from pathlib import Path

import numpy as np
import pytest
from sklearn.linear_model import LinearRegression

from weather_forecast.persistence import (
    latest_version,
    list_versions,
    load_artifact,
    save_artifact,
)


def _fitted_model():
    X = np.arange(20, dtype=float).reshape(-1, 1)
    y = 3 * X.ravel() + 1
    return LinearRegression().fit(X, y), X


def test_save_artifact_writes_model_and_metadata(tmp_path: Path) -> None:
    model, _ = _fitted_model()
    dest = save_artifact(
        model, {"metrics": {"rmse_c": 0.1}}, models_dir=tmp_path, name="forecast", version="v1"
    )
    assert (dest / "model.joblib").exists()
    meta = json.loads((dest / "metadata.json").read_text())
    assert meta["name"] == "forecast" and meta["version"] == "v1"
    assert meta["metrics"]["rmse_c"] == 0.1
    assert "dependency_versions" in meta


def test_load_artifact_round_trips_predictions(tmp_path: Path) -> None:
    model, X = _fitted_model()
    save_artifact(model, {}, models_dir=tmp_path, name="forecast", version="v1")
    loaded, _ = load_artifact(tmp_path, "forecast", version="v1")
    assert np.allclose(loaded.predict(X), model.predict(X))


def test_versions_are_listed_and_latest_resolves(tmp_path: Path) -> None:
    model, _ = _fitted_model()
    save_artifact(model, {}, models_dir=tmp_path, name="forecast", version="20260101T000000Z")
    save_artifact(model, {}, models_dir=tmp_path, name="forecast", version="20260201T000000Z")
    assert list_versions(tmp_path, "forecast") == [
        "20260101T000000Z",
        "20260201T000000Z",
    ]
    assert latest_version(tmp_path, "forecast") == "20260201T000000Z"
    _, meta = load_artifact(tmp_path, "forecast", version="latest")
    assert meta["version"] == "20260201T000000Z"


def test_load_missing_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_artifact(tmp_path, "nope", version="v1")


def test_models_dir_is_gitignored() -> None:
    gitignore = (Path(__file__).resolve().parent.parent / ".gitignore").read_text()
    assert any(line.strip() in ("models/", "models") for line in gitignore.splitlines())
