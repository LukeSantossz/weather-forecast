"""Unit tests for weather_forecast.anomaly."""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from jsonschema import validate

from weather_forecast.anomaly import (
    DEFAULT_IF_FEATURES,
    build_anomaly_model,
    isolation_forest_anomalies,
    overlap_count,
    zscore_anomalies,
)


def test_zscore_flags_outliers() -> None:
    s = pd.Series([10.0] * 50 + [1000.0])
    z, mask = zscore_anomalies(s, threshold=3.0)
    assert bool(mask.iloc[-1])
    assert mask.sum() == 1
    assert abs(float(z.mean())) < 1e-9
    assert abs(float(z.std(ddof=0)) - 1.0) < 1e-9


def test_zscore_threshold_is_overridable() -> None:
    rng = np.random.RandomState(0)
    s = pd.Series(rng.normal(0, 1, 500))
    high = int(zscore_anomalies(s, threshold=3.0)[1].sum())
    low = int(zscore_anomalies(s, threshold=1.0)[1].sum())
    assert low > high


def test_isolation_forest_returns_aligned_mask_and_scores() -> None:
    rng = np.random.RandomState(0)
    X = pd.DataFrame(
        np.vstack([rng.normal(0, 1, (200, 3)), rng.normal(8, 1, (10, 3))]),
        columns=["a", "b", "c"],
    )
    mask, scores = isolation_forest_anomalies(X, contamination=0.05)
    assert isinstance(mask, pd.Series) and isinstance(scores, pd.Series)
    assert len(mask) == len(X) and mask.index.equals(X.index)
    assert mask.sum() >= 1
    more = int(isolation_forest_anomalies(X, contamination=0.1)[0].sum())
    assert more >= int(mask.sum())


def test_isolation_forest_is_seeded() -> None:
    rng = np.random.RandomState(1)
    X = pd.DataFrame(rng.normal(0, 1, (100, 3)), columns=["a", "b", "c"])
    m1 = isolation_forest_anomalies(X, seed=7)[0]
    m2 = isolation_forest_anomalies(X, seed=7)[0]
    assert m1.equals(m2)


def test_overlap_count_counts_both() -> None:
    a = pd.Series([True, True, False, False])
    b = pd.Series([True, False, True, False])
    assert overlap_count(a, b) == 1


def _synthetic_weather(n: int = 300) -> pd.DataFrame:
    rng = np.random.default_rng(0)
    return pd.DataFrame(
        {
            "temperature_celsius": rng.normal(15, 8, n),
            "humidity": rng.uniform(10, 100, n),
            "wind_kph": rng.uniform(0, 60, n),
            "pressure_mb": rng.normal(1013, 12, n),
            "precip_mm": rng.exponential(1.0, n),
        }
    )


def test_build_anomaly_model_shape_and_determinism() -> None:
    df = _synthetic_weather()
    m = build_anomaly_model(df, generated_at="2026-07-05T00:00:00Z")

    assert m["data_status"] == "real"
    assert m["features"] == list(DEFAULT_IF_FEATURES)
    assert len(m["scaler"]["mean"]) == 5 and len(m["scaler"]["scale"]) == 5
    assert len(m["medians"]) == 5
    assert len(m["feature_ranges"]["min"]) == 5 and len(m["feature_ranges"]["max"]) == 5
    assert m["zscore"]["threshold"] == 3.0
    assert len(m["isolation_forest"]["trees"]) == 200
    assert isinstance(m["isolation_forest"]["max_samples"], int)

    # determinism: same seed and data -> byte-identical export
    assert m == build_anomaly_model(df, generated_at="2026-07-05T00:00:00Z")

    # each tree exposes the five parallel node arrays of equal length
    t = m["isolation_forest"]["trees"][0]
    length = len(t["feature"])
    assert all(
        len(t[k]) == length
        for k in ("threshold", "children_left", "children_right", "n_node_samples")
    )


def test_shipped_anomaly_model_validates_against_schema() -> None:
    root = Path(__file__).resolve().parents[1]
    payload = json.loads((root / "web/public/data/anomaly_model.json").read_text())
    schema = json.loads((root / "web/public/data/schema/anomaly_model.schema.json").read_text())
    validate(instance=payload, schema=schema)
    assert payload["data_status"] == "real"
    assert payload["features"] == list(DEFAULT_IF_FEATURES)
    assert len(payload["isolation_forest"]["trees"]) == 200
