"""Unit tests for src/conformal.py (split-conformal prediction intervals)."""

from __future__ import annotations

import numpy as np
import pytest

from weather_forecast.conformal import (
    calibration_residuals,
    conformal_quantile,
    empirical_coverage,
    prediction_interval,
)


class TestCalibrationResiduals:
    """Tests for calibration_residuals function."""

    def test_returns_absolute_residuals(self) -> None:
        y_true = np.array([10.0, 20.0, 5.0])
        y_pred = np.array([8.0, 22.0, 5.0])

        result = calibration_residuals(y_true, y_pred)

        np.testing.assert_allclose(result, [2.0, 2.0, 0.0])

    def test_accepts_python_lists(self) -> None:
        result = calibration_residuals([1.0, 2.0], [1.0, 5.0])

        np.testing.assert_allclose(result, [0.0, 3.0])


class TestConformalQuantile:
    """Tests for conformal_quantile function."""

    def test_known_input_quantile_value(self) -> None:
        residuals = np.arange(1, 11, dtype=float)  # 1..10

        q = conformal_quantile(residuals, alpha=0.2)

        # n=10, level = ceil(11*0.8)/10 = ceil(8.8)/10 = 9/10 -> 9th smallest residual
        assert q == 9.0

    def test_small_sample_clips_level_to_max_residual(self) -> None:
        residuals = np.array([2.0, 5.0, 1.0, 4.0])

        q = conformal_quantile(residuals, alpha=0.1)

        # n=4, level = ceil(5*0.9)/4 = ceil(4.5)/4 = 5/4 -> clipped to 1.0 -> max residual
        assert q == 5.0

    def test_empty_residuals_raises(self) -> None:
        with pytest.raises(ValueError, match="empty"):
            conformal_quantile(np.array([]), alpha=0.1)

    @pytest.mark.parametrize("alpha", [0.0, 1.0, -0.1, 1.5])
    def test_invalid_alpha_raises(self, alpha: float) -> None:
        with pytest.raises(ValueError, match="alpha"):
            conformal_quantile(np.array([1.0, 2.0, 3.0]), alpha=alpha)


class TestPredictionInterval:
    """Tests for prediction_interval function."""

    def test_scalar_interval_is_symmetric_around_point(self) -> None:
        lower, upper = prediction_interval(10.0, q=2.5)

        assert lower == 7.5
        assert upper == 12.5
        assert upper - 10.0 == 10.0 - lower

    def test_accepts_array_point(self) -> None:
        points = np.array([0.0, 10.0, -5.0])

        lower, upper = prediction_interval(points, q=1.0)

        np.testing.assert_allclose(lower, [-1.0, 9.0, -6.0])
        np.testing.assert_allclose(upper, [1.0, 11.0, -4.0])


class TestEmpiricalCoverage:
    """Tests for empirical_coverage function."""

    def test_fraction_within_bounds(self) -> None:
        y_true = np.array([1.0, 2.0, 3.0, 4.0])
        lower = np.array([0.0, 0.0, 0.0, 0.0])
        upper = np.array([1.5, 1.5, 3.5, 3.5])

        coverage = empirical_coverage(y_true, lower, upper)

        assert coverage == 0.5

    def test_full_coverage(self) -> None:
        y_true = np.array([1.0, 2.0, 3.0])

        coverage = empirical_coverage(y_true, lower=0.0, upper=10.0)

        assert coverage == 1.0

    def test_coverage_meets_nominal_level_on_synthetic_split(self) -> None:
        """Split-conformal marginal coverage guarantee, verified end-to-end on
        a synthetic calibration/test split drawn from the same distribution."""
        rng = np.random.default_rng(20260703)
        alpha = 0.1
        n_cal, n_test = 1000, 2000

        y_pred_cal = np.zeros(n_cal)
        y_pred_test = np.zeros(n_test)
        y_true_cal = y_pred_cal + rng.normal(0.0, 1.0, n_cal)
        y_true_test = y_pred_test + rng.normal(0.0, 1.0, n_test)

        residuals_cal = calibration_residuals(y_true_cal, y_pred_cal)
        q = conformal_quantile(residuals_cal, alpha)
        lower, upper = prediction_interval(y_pred_test, q)
        coverage = empirical_coverage(y_true_test, lower, upper)

        tolerance = 0.03
        assert coverage >= (1 - alpha) - tolerance
