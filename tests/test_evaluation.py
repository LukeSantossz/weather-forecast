"""Unit tests for weather_forecast.evaluation."""

import numpy as np

from weather_forecast.evaluation import compute_metrics, mae, mape, rmse


def test_rmse_matches_manual() -> None:
    yt = np.array([1.0, 2.0, 3.0])
    yp = np.array([1.0, 2.0, 5.0])
    assert np.isclose(rmse(yt, yp), np.sqrt(4 / 3))


def test_mae_matches_manual() -> None:
    yt = np.array([1.0, 2.0, 3.0])
    yp = np.array([1.0, 4.0, 3.0])
    assert np.isclose(mae(yt, yp), 2 / 3)


def test_mape_ignores_zero_truth() -> None:
    yt = np.array([0.0, 2.0])
    yp = np.array([5.0, 3.0])
    assert np.isclose(mape(yt, yp), 50.0)


def test_compute_metrics_returns_expected_keys() -> None:
    m = compute_metrics(np.array([1.0, 2.0]), np.array([1.0, 2.0]))
    assert set(m) == {"rmse_c", "mae_c", "mape_pct"}
    assert m["rmse_c"] == 0.0
