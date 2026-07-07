# CONTEXT: Domain Glossary

The ubiquitous language for weather-forecast. Use these terms verbatim in issues, specs,
ADRs, tests, and code; do not drift to synonyms.

## Series and evaluation

- **Global daily-mean temperature series** - the single univariate `(ds, y)` series the
  forecast targets: `temperature_celsius` averaged across all countries for each calendar day.
  Not per-country.
- **Holdout evaluation** - the final 30 days are held out as the test window and scored exactly
  once; the LightGBM early-stopping slice and the ensemble weights come from a validation tail
  carved out of the training window, never the test window.
- **RMSE / MAE / MAPE** - the reported forecast error metrics, in Celsius for RMSE and MAE.

## Forecast models

- **GradientBoosting / LightGBM** - the autoregressive ML forecasters, trained on
  `create_features` (lags of `y`, rolling mean/std on `y.shift(1)`, calendar and cyclical
  features).
- **ARIMA / SARIMA** - the classical statistical baselines (statsmodels).
- **Inverse-RMSE weighted ensemble** - combines the per-model forecasts with weights set from
  validation-set RMSEs; the simple ensemble is the row-wise mean.

## Anomalies

- **Z-score anomaly** - a temperature reading flagged by `|z| > 3` against the series population.
- **Isolation Forest anomaly** - a reading flagged by an Isolation Forest over five features
  (`temperature_celsius`, `humidity`, `wind_kph`, `pressure_mb`, `precip_mm`).
- **Overlap** - readings flagged by both methods; the highest-confidence anomalies.

## Drivers and provenance

- **SHAP driver reading** - the mean-absolute SHAP feature importances for the PM2.5
  air-quality model, surfaced as the drivers act.
- **Provenance (sample / real)** - every data artifact carries `data_status: "sample" | "real"`
  and every metric row `status: "final" | "pending_rerun"`; honesty lives in the data.
