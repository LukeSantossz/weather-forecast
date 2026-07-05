"""Anomaly detection: Z-score and Isolation Forest.

Sub-module 4 of the pipeline-extraction epic (#14). Extracted from notebook 04:
a population Z-score detector on temperature and an Isolation Forest over
median-filled, standardized weather features.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

DEFAULT_IF_FEATURES = (
    "temperature_celsius",
    "humidity",
    "wind_kph",
    "pressure_mb",
    "precip_mm",
)


def zscore_anomalies(values: pd.Series, *, threshold: float = 3.0) -> tuple[pd.Series, pd.Series]:
    """Flag ``|z| > threshold`` anomalies using the population standard deviation.

    Returns:
        ``(z_scores, is_anomaly)`` aligned to ``values``' index.
    """
    v = values.astype(float)
    mu = float(v.mean())
    sigma = max(float(v.std(ddof=0)), 1e-9)
    z = (v - mu) / sigma
    return z, z.abs() > threshold


def isolation_forest_anomalies(
    X: pd.DataFrame,
    *,
    contamination: float = 0.02,
    n_estimators: int = 200,
    seed: int = 42,
) -> tuple[pd.Series, pd.Series]:
    """Fit an Isolation Forest on median-filled, standardized features.

    Returns:
        ``(is_anomaly, scores)`` as ``pd.Series`` aligned to ``X``'s index;
        ``is_anomaly`` is ``True`` where the forest predicts an outlier and
        ``scores`` are ``score_samples`` (higher is more normal).
    """
    filled = X.fillna(X.median())
    scaled = StandardScaler().fit_transform(filled)
    iso = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=seed,
        n_jobs=-1,
    )
    pred = iso.fit_predict(scaled)
    scores = iso.score_samples(scaled)
    return (
        pd.Series(pred == -1, index=X.index, name="anomaly_if"),
        pd.Series(scores, index=X.index, name="if_score"),
    )


def overlap_count(mask_a: Any, mask_b: Any) -> int:
    """Count the rows where both boolean masks are true."""
    return int((np.asarray(mask_a) & np.asarray(mask_b)).sum())
