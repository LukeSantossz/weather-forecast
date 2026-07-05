"""Unit tests for weather_forecast.anomaly."""

import numpy as np
import pandas as pd

from weather_forecast.anomaly import (
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
