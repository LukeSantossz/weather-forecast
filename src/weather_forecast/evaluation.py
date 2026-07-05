"""Forecast evaluation metrics.

Sub-module 5 of the pipeline-extraction epic (#14). The RMSE/MAE/MAPE from
notebook 06's ``calc_metrics``, as pure functions (MAPE ignores zero-truth rows).
"""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error


def rmse(y_true: Any, y_pred: Any) -> float:
    """Root mean squared error."""
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def mae(y_true: Any, y_pred: Any) -> float:
    """Mean absolute error."""
    return float(mean_absolute_error(y_true, y_pred))


def mape(y_true: Any, y_pred: Any) -> float:
    """Mean absolute percentage error, ignoring zero-truth entries."""
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_pred, dtype=float)
    mask = yt != 0
    return float(np.mean(np.abs((yt[mask] - yp[mask]) / yt[mask])) * 100)


def compute_metrics(y_true: Any, y_pred: Any) -> dict[str, float]:
    """Return ``{rmse_c, mae_c, mape_pct}`` for a prediction against truth."""
    return {
        "rmse_c": rmse(y_true, y_pred),
        "mae_c": mae(y_true, y_pred),
        "mape_pct": mape(y_true, y_pred),
    }
