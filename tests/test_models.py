"""Unit tests for weather_forecast.models."""

import numpy as np
import pandas as pd

from weather_forecast.models import (
    carve_validation_tail,
    chronological_split,
    fit_arima,
    fit_sarima,
    forecast_steps,
    inverse_rmse_weights,
    simple_average,
    train_gradient_boosting,
    train_lightgbm,
    weighted_ensemble,
)


def _series(n: int = 60) -> pd.Series:
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    y = 20 + 3 * np.sin(np.arange(n) / 3.0) + np.arange(n) * 0.05
    return pd.Series(y, index=idx)


def _xy(n: int = 60, k: int = 3):
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    rng = np.random.RandomState(0)
    X = pd.DataFrame(rng.rand(n, k), columns=[f"f{i}" for i in range(k)], index=idx)
    y = pd.Series(rng.rand(n), index=idx)
    return X, y


class TestSplitHelpers:
    def test_chronological_split_is_time_ordered(self) -> None:
        df = _series(50).to_frame("y")
        cutoff = df.index[39]
        train, test = chronological_split(df, cutoff)
        assert len(train) == 40 and len(test) == 10
        assert train.index.max() <= cutoff < test.index.min()

    def test_carve_validation_tail_takes_last_val_size(self) -> None:
        X, y = _xy(40)
        X_tr, X_val, y_tr, y_val = carve_validation_tail(X, y, 10)
        assert len(X_val) == 10 and len(X_tr) == 30
        assert X_val.index[0] == X.index[30]
        assert len(y_val) == 10 and len(y_tr) == 30


class TestEnsembleMath:
    def test_inverse_rmse_weights_are_normalized_and_inverse(self) -> None:
        w = inverse_rmse_weights([1.0, 2.0])
        assert np.isclose(w.sum(), 1.0)
        assert w[0] > w[1]

    def test_weighted_ensemble_matches_manual(self) -> None:
        preds = [np.array([1.0, 2.0]), np.array([3.0, 4.0])]
        out = weighted_ensemble(preds, np.array([0.25, 0.75]))
        assert np.allclose(out, [0.25 * 1 + 0.75 * 3, 0.25 * 2 + 0.75 * 4])

    def test_simple_average_matches_mean(self) -> None:
        preds = [np.array([1.0, 3.0]), np.array([3.0, 5.0])]
        assert np.allclose(simple_average(preds), [2.0, 4.0])


class TestTrainers:
    def test_train_lightgbm_fits_and_predicts(self) -> None:
        X, y = _xy(60)
        X_tr, X_val, y_tr, y_val = carve_validation_tail(X, y, 10)
        model = train_lightgbm(X_tr, y_tr, X_val, y_val, num_boost_round=50, stopping_rounds=10)
        pred = model.predict(X_val, num_iteration=model.best_iteration)
        assert len(pred) == 10

    def test_train_gradient_boosting_fits_and_predicts(self) -> None:
        X, y = _xy(40)
        model = train_gradient_boosting(X, y)
        assert len(model.predict(X.head(5))) == 5

    def test_fit_arima_forecasts(self) -> None:
        fit = fit_arima(_series(50))
        assert len(forecast_steps(fit, 5)) == 5

    def test_fit_sarima_forecasts(self) -> None:
        fit = fit_sarima(_series(50))
        assert len(forecast_steps(fit, 5)) == 5
