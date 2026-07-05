"""End-to-end forecast orchestration and training CLI.

Sub-module 5 of the pipeline-extraction epic (#14). Composes ``config``,
``features``, ``models``, and ``evaluation`` into a leakage-free forecast run and
a ``python -m weather_forecast.train`` CLI. The LightGBM early-stopping and the
weighted-ensemble weights come from a validation tail carved out of the training
window, never from the test window (issue #20).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from weather_forecast.config import PipelineConfig, set_global_seed
from weather_forecast.data_loader import load_raw_weather
from weather_forecast.evaluation import compute_metrics, rmse
from weather_forecast.features import create_features
from weather_forecast.logging_setup import configure_logging, get_logger
from weather_forecast.models import (
    carve_validation_tail,
    fit_arima,
    fit_sarima,
    forecast_steps,
    inverse_rmse_weights,
    simple_average,
    train_gradient_boosting,
    train_lightgbm,
    weighted_ensemble,
)
from weather_forecast.persistence import save_artifact

_DEFAULT_CONFIG = PipelineConfig()


def run_forecast(
    daily: pd.DataFrame, *, config: PipelineConfig = _DEFAULT_CONFIG
) -> dict[str, dict[str, float]]:
    """Run the daily forecast end-to-end and return per-model metrics.

    Args:
        daily: A ``(ds, y)`` daily-mean temperature frame.
        config: Hyperparameters and the global seed.

    Returns:
        ``{model_id: {rmse_c, mae_c, mape_pct}}`` for arima, sarima, lightgbm,
        gradientboosting, ensemble_simple, and ensemble_weighted.
    """
    set_global_seed(config.seed)
    tw = config.test_window_days
    vs = config.val_size

    series = daily.set_index("ds").sort_index()["y"]
    series_train = series.iloc[:-tw]

    feats = create_features(daily).dropna()
    feature_cols = [c for c in feats.columns if c != "y"]
    train_feats, test_feats = feats.iloc[:-tw], feats.iloc[-tw:]
    X_train, y_train = train_feats[feature_cols], train_feats["y"]
    X_test, y_test = test_feats[feature_cols], test_feats["y"]
    y_true = y_test.to_numpy()

    X_tr, X_val, y_tr, y_val = carve_validation_tail(X_train, y_train, vs)

    lgb_model = train_lightgbm(X_tr, y_tr, X_val, y_val)
    lgb_pred = lgb_model.predict(X_test, num_iteration=lgb_model.best_iteration)
    gb_model = train_gradient_boosting(X_train, y_train)
    gb_pred = gb_model.predict(X_test)

    arima_pred = forecast_steps(fit_arima(series_train), tw)
    sarima_pred = forecast_steps(fit_sarima(series_train), tw)

    preds = [arima_pred, sarima_pred, lgb_pred, gb_pred]
    results: dict[str, dict[str, float]] = {
        "arima": compute_metrics(y_true, arima_pred),
        "sarima": compute_metrics(y_true, sarima_pred),
        "lightgbm": compute_metrics(y_true, lgb_pred),
        "gradientboosting": compute_metrics(y_true, gb_pred),
        "ensemble_simple": compute_metrics(y_true, simple_average(preds)),
    }

    # Weighted ensemble: weights from an out-of-sample validation holdout so the
    # test window is never used to choose them (leakage-free, issue #20).
    lgb_val_pred = lgb_model.predict(X_val, num_iteration=lgb_model.best_iteration)
    gb_val_pred = train_gradient_boosting(X_tr, y_tr).predict(X_val)
    series_fit_val = series_train.iloc[:-vs]
    arima_val_pred = forecast_steps(fit_arima(series_fit_val), vs)
    sarima_val_pred = forecast_steps(fit_sarima(series_fit_val), vs)

    val_truth = series_train.iloc[-vs:].to_numpy()
    y_val_arr = y_val.to_numpy()
    val_rmses = [
        rmse(val_truth, arima_val_pred),
        rmse(val_truth, sarima_val_pred),
        rmse(y_val_arr, lgb_val_pred),
        rmse(y_val_arr, gb_val_pred),
    ]
    weights = inverse_rmse_weights(val_rmses)
    results["ensemble_weighted"] = compute_metrics(y_true, weighted_ensemble(preds, weights))
    return results


def _daily_from_raw(project_root: Path) -> pd.DataFrame:
    df = load_raw_weather(project_root)
    daily = (
        df.groupby(df["last_updated"].dt.normalize())["temperature_celsius"].mean().reset_index()
    )
    daily.columns = ["ds", "y"]
    daily["ds"] = pd.to_datetime(daily["ds"])
    return daily.sort_values("ds").reset_index(drop=True)


def main(argv: list[str] | None = None) -> int:
    """CLI: train the daily forecast and print per-model metrics."""
    parser = argparse.ArgumentParser(
        prog="weather_forecast.train",
        description="Train the daily temperature forecast and report metrics.",
    )
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--test-window-days", type=int, default=None)
    parser.add_argument("--val-size", type=int, default=None)
    parser.add_argument(
        "--save",
        action="store_true",
        help="Persist the fitted ARIMA forecaster as a versioned artifact.",
    )
    parser.add_argument("--models-dir", type=Path, default=Path("models"))
    parser.add_argument(
        "--track",
        action="store_true",
        help="Log params, metrics, and the saved artifact to MLflow.",
    )
    parser.add_argument(
        "--tracking-uri",
        type=str,
        default=None,
        help="MLflow tracking URI (defaults to the ambient mlruns/ file store).",
    )
    args = parser.parse_args(argv)

    overrides = {}
    if args.seed is not None:
        overrides["seed"] = args.seed
    if args.test_window_days is not None:
        overrides["test_window_days"] = args.test_window_days
    if args.val_size is not None:
        overrides["val_size"] = args.val_size
    config = PipelineConfig.from_dict(overrides)

    configure_logging()
    log = get_logger("weather_forecast.train")
    log.info("loading raw data from %s", args.project_root)
    daily = _daily_from_raw(args.project_root)
    log.info("running forecast on %d daily points (seed=%d)", len(daily), config.seed)

    results = run_forecast(daily, config=config)
    for model_id, m in results.items():
        print(f"{model_id}: rmse={m['rmse_c']:.4f} mae={m['mae_c']:.4f} mape={m['mape_pct']:.4f}")

    saved_dir: Path | None = None
    if args.save:
        # Fit the forecaster on the full series so it can predict beyond the
        # last observation, then persist it with the run metrics for lineage.
        series = daily.set_index("ds").sort_index()["y"]
        forecaster = fit_arima(series)
        saved_dir = save_artifact(
            forecaster,
            {"metrics": results, "seed": config.seed, "test_window_days": config.test_window_days},
            models_dir=args.models_dir,
            name="forecaster",
        )
        log.info("saved forecaster artifact to %s", saved_dir)

    if args.track:
        from weather_forecast.tracking import log_training_run

        run_id = log_training_run(
            {
                "seed": config.seed,
                "test_window_days": config.test_window_days,
                "val_size": config.val_size,
            },
            results,
            tracking_uri=args.tracking_uri,
            artifact_path=saved_dir,
        )
        log.info("logged MLflow run %s", run_id)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
