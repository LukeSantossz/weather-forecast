"""Forecasting models, chronological split, and ensembling.

Sub-module 3 of the pipeline-extraction epic (#14). Trainers and helpers
extracted from notebook 06 with its exact hyperparameters, preserving the
leakage-free split discipline from #20: the validation tail is carved from the
training window, and ensemble weights come from validation RMSEs.
"""

from __future__ import annotations

from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

ARIMA_ORDER = (5, 1, 0)
SARIMA_ORDER = (1, 1, 1)
SARIMA_SEASONAL_ORDER = (1, 1, 1, 7)

LGB_PARAMS: dict[str, Any] = {
    "objective": "regression",
    "metric": "rmse",
    "boosting_type": "gbdt",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "verbose": -1,
    "seed": 42,
}
GB_PARAMS: dict[str, Any] = {
    "n_estimators": 200,
    "learning_rate": 0.05,
    "max_depth": 5,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "subsample": 0.8,
    "random_state": 42,
}


def chronological_split(data: pd.DataFrame, cutoff: Any) -> tuple[Any, Any]:
    """Split a time-indexed frame/series at ``cutoff`` (no shuffle): (train, test)."""
    return data[data.index <= cutoff], data[data.index > cutoff]


def carve_validation_tail(
    X_train: pd.DataFrame, y_train: pd.Series, val_size: int
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Carve the last ``val_size`` rows as validation: (X_tr, X_val, y_tr, y_val)."""
    return (
        X_train.iloc[:-val_size],
        X_train.iloc[-val_size:],
        y_train.iloc[:-val_size],
        y_train.iloc[-val_size:],
    )


def train_lightgbm(
    X_tr: pd.DataFrame,
    y_tr: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    *,
    params: dict[str, Any] | None = None,
    num_boost_round: int = 500,
    stopping_rounds: int = 50,
) -> lgb.Booster:
    """Train LightGBM with early stopping on the validation tail."""
    merged = {**LGB_PARAMS, **(params or {})}
    train_set = lgb.Dataset(X_tr, label=y_tr)
    val_set = lgb.Dataset(X_val, label=y_val, reference=train_set)
    return lgb.train(
        merged,
        train_set,
        num_boost_round=num_boost_round,
        valid_sets=[train_set, val_set],
        valid_names=["train", "valid"],
        callbacks=[lgb.early_stopping(stopping_rounds=stopping_rounds, verbose=False)],
    )


def train_gradient_boosting(
    X: pd.DataFrame, y: pd.Series, *, params: dict[str, Any] | None = None
) -> GradientBoostingRegressor:
    """Fit a GradientBoostingRegressor with the notebook's hyperparameters."""
    model = GradientBoostingRegressor(**{**GB_PARAMS, **(params or {})})
    model.fit(X, y)
    return model


def fit_arima(series: pd.Series, *, order: tuple[int, int, int] = ARIMA_ORDER) -> Any:
    """Fit an ARIMA model."""
    return ARIMA(series, order=order).fit()


def fit_sarima(
    series: pd.Series,
    *,
    order: tuple[int, int, int] = SARIMA_ORDER,
    seasonal_order: tuple[int, int, int, int] = SARIMA_SEASONAL_ORDER,
) -> Any:
    """Fit a SARIMAX model with the notebook's flags."""
    return SARIMAX(
        series,
        order=order,
        seasonal_order=seasonal_order,
        enforce_stationarity=False,
        enforce_invertibility=False,
    ).fit(disp=False)


def forecast_steps(fit: Any, steps: int) -> np.ndarray:
    """Forecast ``steps`` ahead from a fitted statsmodels result, as a numpy array."""
    return np.asarray(fit.forecast(steps=steps))


def inverse_rmse_weights(rmses: Any) -> np.ndarray:
    """Normalized inverse-RMSE weights (smaller RMSE -> larger weight)."""
    inv = 1.0 / np.asarray(rmses, dtype=float)
    return inv / inv.sum()


def weighted_ensemble(predictions: Any, weights: Any) -> np.ndarray:
    """Weighted sum of per-model prediction arrays."""
    preds = np.asarray(predictions, dtype=float)
    return np.asarray(weights, dtype=float) @ preds


def simple_average(predictions: Any) -> np.ndarray:
    """Row-wise mean of per-model prediction arrays."""
    return np.mean(np.asarray(predictions, dtype=float), axis=0)
