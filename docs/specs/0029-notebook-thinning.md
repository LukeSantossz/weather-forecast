# SPEC: chore(notebooks): call src instead of redefining logic (close #14)

## Problem
The #14 epic extracted the pipeline into tested `src` modules (features, models, anomaly, evaluation, config, CLI) across SPECs 0019-0023, all merged. Its final acceptance criterion, "notebooks call `src` instead of redefining the logic", is only partly met: notebook 06 still defines its own `create_features`, and notebook 04 computes the Z-score inline. This SPEC closes that gap so the epic can be closed.

## Design Decision
Thin the two notebooks to call the tested `src` functions, verified byte-for-byte equivalent to the inline code (identical constants: lags `(1,2,3,7,14,21)`, rolling `(7,14,30)`, Z threshold `3.0`, IF `contamination=0.02`, `n_estimators=200`, `seed=42`, IF feature list):

- `06_advanced_forecasting`: replace the local `def create_features` with `from weather_forecast.features import create_features`.
- `04_anomaly_detection`: replace the inline Z-score block with `weather_forecast.anomaly.zscore_anomalies`, preserving every downstream variable (`z_temp`, `anomaly_zscore`, `n_z`, and `mu`/`sigma` for the printout).

The Isolation-Forest cell in `04` is intentionally left inline: it binds the fitted `iso` estimator, which later exploratory cells reuse (decision scores, feature inspection). The `src` `isolation_forest_anomalies` returns only flags and scores, not the model, so calling it would break those cells; exposing the model is a legitimate notebook (EDA) concern, not logic duplication.

## Alternatives Considered
- **Change `isolation_forest_anomalies` to also return the estimator.** Rejected: widening the library API to serve one notebook's EDA is the wrong direction; the notebook keeping its own fit is clearer.
- **Leave notebook 06 as-is.** Rejected: its `create_features` is a verbatim copy of the `src` function, the clearest case of the duplication #14 set out to remove.

## Scope
- Includes: the two notebook edits above; execution-verified; SPEC record.
- Does NOT include: rewriting notebook narrative/plots, touching notebooks 01/02/03/05/07 (already thin or unaffected), or changing any `src` API.

## Acceptance Criteria
- Notebook 06 imports `create_features` from `weather_forecast.features` and defines it nowhere.
- Notebook 04 flags Z-score anomalies via `weather_forecast.anomaly.zscore_anomalies`, with all downstream cells unchanged and still resolving their variables.
- Both notebooks execute end-to-end (`nbconvert --execute`) against the real dataset with no errors.
- #14's acceptance criteria are all satisfied, so #14 is closed.

## Reproducibility
`jupyter nbconvert --to notebook --execute notebooks/04_anomaly_detection.ipynb` and `.../06_advanced_forecasting.ipynb` against `data/raw/GlobalWeatherRepository.csv`. Notebooks are committed output-stripped (nbstripout convention).

## Risks and Assumptions
- Assumption: the `src` functions are drop-in equivalents (constants verified equal, and the modules were extracted from these very notebooks); execution confirms it.
- Low risk: notebooks are excluded from CI and lint, but execution-verification here covers them; only source cells changed, and any regenerated `web/public/data` export from a run is reverted so committed data is untouched.
