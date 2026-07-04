"""
Split-conformal prediction intervals for point forecasts.

Pipeline: absolute calibration residuals -> finite-sample-corrected residual
quantile -> symmetric prediction interval -> empirical coverage check.

Phase 1 (issue #31): a pure, dependency-free (numpy only) module. Wiring this
into a notebook or the dashboard is an explicit follow-up, not included here.
"""

from __future__ import annotations

import math
from typing import Sequence, Union

import numpy as np

ArrayLike = Union[np.ndarray, Sequence[float]]
PointLike = Union[float, np.ndarray, Sequence[float]]


def calibration_residuals(y_true: ArrayLike, y_pred: ArrayLike) -> np.ndarray:
    """
    Compute absolute residuals between observed and predicted values.

    Args:
        y_true: Observed values from the calibration set.
        y_pred: Point predictions for the same calibration set.

    Returns:
        Element-wise absolute residuals ``|y_true - y_pred|`` as a
        ``np.ndarray`` of floats.
    """
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)
    return np.abs(y_true_arr - y_pred_arr)


def conformal_quantile(residuals: ArrayLike, alpha: float) -> float:
    """
    Compute the split-conformal quantile of calibration residuals.

    Uses the standard split-conformal finite-sample correction: the quantile
    level is ``ceil((n + 1) * (1 - alpha)) / n``, clipped to ``[0, 1]``. The
    quantile itself is the corresponding order statistic — the ``k``-th
    smallest residual, with ``k`` the clipped level's rank out of ``n`` — not
    a continuous-interpolation quantile, matching the split-conformal
    literature (Vovk et al.; Lei et al. 2018).

    Args:
        residuals: Non-negative calibration residuals, e.g. from
            ``calibration_residuals``.
        alpha: Miscoverage level in ``(0, 1)``; target coverage is
            ``1 - alpha``.

    Returns:
        The split-conformal quantile as a float.

    Raises:
        ValueError: If ``residuals`` is empty or ``alpha`` is not in
            ``(0, 1)``.
    """
    residuals_arr = np.asarray(residuals, dtype=float)
    n = residuals_arr.size
    if n == 0:
        raise ValueError("residuals must not be empty")
    if not (0.0 < alpha < 1.0):
        raise ValueError(f"alpha must be in (0, 1), got {alpha!r}")

    level = math.ceil((n + 1) * (1 - alpha)) / n
    level = float(np.clip(level, 0.0, 1.0))
    rank = int(round(level * n))
    rank = max(1, min(rank, n))

    sorted_residuals = np.sort(residuals_arr)
    return float(sorted_residuals[rank - 1])


def prediction_interval(
    point: PointLike, q: float
) -> tuple[float, float] | tuple[np.ndarray, np.ndarray]:
    """
    Build a symmetric prediction interval around a point forecast.

    Args:
        point: Point forecast(s); a scalar or an array of forecasts.
        q: Half-width of the interval, typically from
            ``conformal_quantile``.

    Returns:
        A ``(lower, upper)`` tuple: ``(point - q, point + q)``. Returns
        floats when ``point`` is a scalar, or a pair of ``np.ndarray`` when
        ``point`` is array-like.
    """
    point_arr = np.asarray(point, dtype=float)
    lower = point_arr - q
    upper = point_arr + q
    if point_arr.ndim == 0:
        return float(lower), float(upper)
    return lower, upper


def empirical_coverage(
    y_true: ArrayLike, lower: PointLike, upper: PointLike
) -> float:
    """
    Compute the empirical coverage of prediction intervals.

    Args:
        y_true: Observed values on the evaluation (test) set.
        lower: Lower interval bound(s); scalar or broadcastable array.
        upper: Upper interval bound(s); scalar or broadcastable array.

    Returns:
        The fraction of ``y_true`` values within ``[lower, upper]``, as a
        float in ``[0, 1]``.
    """
    y_true_arr = np.asarray(y_true, dtype=float)
    lower_arr = np.asarray(lower, dtype=float)
    upper_arr = np.asarray(upper, dtype=float)
    within_bounds = (y_true_arr >= lower_arr) & (y_true_arr <= upper_arr)
    return float(np.mean(within_bounds))
