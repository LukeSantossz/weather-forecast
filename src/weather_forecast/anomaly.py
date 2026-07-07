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


def build_anomaly_model(
    df: pd.DataFrame,
    *,
    generated_at: str,
    seed: int = 42,
    contamination: float = 0.02,
    n_estimators: int = 200,
) -> dict[str, Any]:
    """Fit the anomaly models and serialize everything the browser needs to infer.

    Mirrors ``isolation_forest_anomalies`` (median fill, then StandardScaler, then
    IsolationForest) and ``zscore_anomalies`` (population mu/sigma on temperature) so the
    exported model reproduces both methods client-side. Every fitted tree is emitted as five
    parallel node arrays (``feature`` uses ``-2`` for leaves), alongside the scaler
    parameters, the median fill values, the observed per-feature ranges (for slider domains),
    ``max_samples`` and ``offset`` (for the ``score_samples`` normalization and the predict
    threshold), and the z-score baseline.
    """
    feats = list(DEFAULT_IF_FEATURES)
    X = df[feats].astype(float)
    medians = X.median()
    filled = X.fillna(medians)
    scaler = StandardScaler().fit(filled)
    iso = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=seed,
        n_jobs=-1,
    ).fit(scaler.transform(filled))

    def _tree(est: Any) -> dict[str, list]:
        t = est.tree_
        return {
            "feature": t.feature.tolist(),
            "threshold": t.threshold.tolist(),
            "children_left": t.children_left.tolist(),
            "children_right": t.children_right.tolist(),
            "n_node_samples": t.n_node_samples.tolist(),
        }

    temp = df["temperature_celsius"].astype(float)
    mu = float(temp.mean())
    sigma = max(float(temp.std(ddof=0)), 1e-9)

    return {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "data_status": "real",
        "features": feats,
        "scaler": {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
        "medians": medians.tolist(),
        "feature_ranges": {"min": filled.min().tolist(), "max": filled.max().tolist()},
        "zscore": {"mu": mu, "sigma": sigma, "threshold": 3.0},
        "isolation_forest": {
            "max_samples": int(iso.max_samples_),
            "offset": float(iso.offset_),
            "trees": [_tree(e) for e in iso.estimators_],
        },
    }
