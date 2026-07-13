# SPEC: feat(web): live forecast studio with all six models re-forecasting client-side

Second interactive sub-project (SP2), built on the SP1 browser-inference core
(`docs/specs/0033-browser-inference-anomaly-checker.md`). It turns the read-only Forecast act
into a studio the visitor operates: they edit the recent history and pick a horizon, and all
six forecasters (ARIMA, SARIMA, LightGBM, GradientBoosting, and the simple and weighted
ensembles) re-forecast live in the browser from the perturbed state, using their fixed fitted
parameters, with no backend and no network call after load. It changes no pipeline numerical
behavior and no existing contract file; it adds one new contract artifact and extends the SP1
inference engine.

## Problem

The Forecast act presents a static observed-vs-forecast chart and a model leaderboard, but the
visitor cannot explore how the models behave. The pipeline's forecasters run only in Python at
build time over the true series: the ML models (`train_gradient_boosting`, `train_lightgbm`)
are autoregressive over `create_features` (lags of `y`, rolling mean/std on `y.shift(1)`, and
calendar/cyclical features), and the classical baselines (`fit_arima` ARIMA(5,1,0), `fit_sarima`
SARIMA(1,1,1)(1,1,1,7)) are statsmodels fits, combined by an inverse-RMSE weighted ensemble.
None of this responds to a visitor, so the dashboard cannot answer the most engaging question a
skimmer asks of a forecaster: "what would it predict if the recent days looked different?"

## Design Decision

Ship a forecast studio in the Forecast act where the visitor edits the last `K` observed days
(drag points on the chart; `K` chosen so the edit fully propagates through the longest lag and
rolling window) and sets a 1-30 day horizon, and all six forecasts recompute live. Nothing is
retrained: Python fits the models once and exports their parameters (ADR-D), and the browser
re-forecasts from the perturbed recent state with those fixed parameters. The copy states this
plainly so the interaction is not mistaken for online learning.

A build-time exporter writes `web/public/data/forecast_models.json` (with a JSON Schema and
validation): the GradientBoosting and LightGBM trees as leaf-valued regression trees; the ARIMA
coefficients (AR terms, differencing, constant, `sigma2`); the SARIMA parameters (non-seasonal
and seasonal AR/MA, `d`/`D`/`s`, and the fitted state needed to seed forecasting); the
inverse-RMSE ensemble weights; the feature configuration (`lags`, `rolling_windows`, and the
calendar/cyclical spec); and the recent-history window that seeds the studio.

The browser inference engine extends SP1's shared tree-traversal primitive with a leaf-value
scorer for GradientBoosting and LightGBM, a JS reimplementation of `create_features` for the
recursive multi-step rollout (predict one step, feed it back as the next lag, recompute rolling
stats, advance the calendar), the ARIMA forecast recursion, the SARIMA forecast recursion, and
the ensemble combination. Each piece is validated against Python golden vectors.

SARIMA re-forecasting from a perturbed state (its moving-average terms need the innovations for
the perturbed window, i.e. a forward filter pass) is the hardest piece and is governed by an
explicit fidelity ladder, so the SPEC never promises fidelity it may not sustain:

- **F1 (target):** full SARIMA in JS (forward filter for the MA innovations), parity within the
  documented tolerance against Python golden vectors.
- **F2 (fallback):** if the filter pass cannot reach parity, SARIMA re-forecasts from its
  AR and seasonal-AR terms only, as a documented approximation, and its parity test relaxes to a
  stated wider tolerance with an explicit note.
- **F3 (floor):** if still infeasible, SARIMA becomes a static precomputed baseline that does
  not respond to perturbation, while ARIMA, GradientBoosting, LightGBM, and the ensembles stay
  fully live; this degradation is recorded as a known issue and an ADR.

## Architecture Decisions

Promoted to numbered ADRs under `docs/adr/` at the Spec Gate:

- **ADR (fixed-parameter re-forecasting, no browser training).** Interactive forecasts are
  produced by re-running fitted models from a perturbed input state with parameters exported
  from Python; the browser never fits. Rationale: keeps training authority in Python and the app
  a static export, while giving a genuine, honest "what-if" on the real fitted models.
- **ADR (classical models served by exported coefficients).** ARIMA and SARIMA run client-side
  from exported statsmodels coefficients reproduced as forecast recursions, not via a backend and
  not via a JS statistics library. Rationale: no runtime dependency and full control over the
  recursion; bounded by the SARIMA fidelity ladder.
- **ADR (SARIMA fidelity ladder F1/F2/F3).** The delivered SARIMA fidelity is whichever ladder
  tier meets its parity criterion, recorded explicitly. Rationale: scope honesty about a genuinely
  hard client-side reimplementation.

## Scope

- **Includes:**
  - A Python exporter (following the `dashboard_export.py` real/sample pattern) that fits the
    forecasters on the committed data and writes `web/public/data/forecast_models.json` plus its
    JSON Schema under `web/public/data/schema/`, with sample-conformance validation.
  - Extension of the SP1 TypeScript inference engine: a leaf-value tree scorer for
    GradientBoosting and LightGBM; a JS `create_features` reimplementation and the recursive
    multi-step rollout; the ARIMA and SARIMA forecast recursions (SARIMA per the ladder); and the
    simple and inverse-RMSE weighted ensembles.
  - Golden-vector parity tests (Python-generated fixtures, run in the SP1 web test runner) for
    the feature engineering, each model's forecast, and the ensembles, with documented tolerances.
  - A forecast-studio component in the Forecast act: an editable recent-history chart (drag the
    last `K` points), a 1-30 day horizon control, live re-forecast of all six models with the
    ensemble band reforming, per-model toggles, and a reset; keyboard-reachable with visible
    focus, respecting `prefers-reduced-motion`, with a table/text equivalent of the forecast.
  - Loader and mirrored TypeScript types for the new contract file.
  - Copy stating that parameters are fixed and the studio re-forecasts from the perturbed state
    without retraining.
- **Does NOT include:**
  - Any change to the forecast algorithms, the model set, hyperparameters, the committed data,
    or the existing `web/public/data/*` files (the new artifact is additive).
  - CSV upload of the visitor's own series (dropped for model-transfer validity reasons).
  - Per-country forecasting (the series stays the global daily mean).
  - ZKML / verifiable inference (SP3) and deployment (SP4).
  - Any Python-side change to `create_features`; the JS reimplementation must match the existing
    Python behavior, not the reverse.

## Acceptance Criteria

- `forecast_models_artifact_exported_and_validated`: running the exporter writes
  `web/public/data/forecast_models.json`; it validates against its committed JSON Schema; a test
  asserts the sample conforms.
- `feature_engineering_parity`: the JS `create_features` matches the Python `create_features`
  (lags, rolling mean/std on `shift(1)` with pandas `ddof`, calendar and cyclical columns) within
  an absolute tolerance of 1e-6 on Python-generated fixtures.
- `tree_forecast_parity`: on the unperturbed baseline, the JS GradientBoosting and LightGBM
  multi-step forecasts match the Python references within 1e-6.
- `arima_forecast_parity`: the JS ARIMA forecast recursion matches the Python `forecast_steps`
  output within 1e-6 for the baseline and a fixed perturbed state.
- `sarima_fidelity_recorded_and_asserted`: the delivered SARIMA tier (F1, F2, or F3) is recorded
  in the SPEC/ADR and the artifact, and its behavior is asserted: F1 within 1e-6, F2 within the
  documented wider tolerance with the AR-only note, or F3 as a static baseline that does not
  change under perturbation.
- `ensemble_parity`: the JS simple and inverse-RMSE weighted ensembles match the Python
  `simple_average` and `weighted_ensemble` within 1e-6 given the component forecasts.
- `perturbation_reforecasts_from_fixed_params`: editing the recent history changes every live
  model's forecast, while the exported parameters are unchanged (no retraining), verified in the
  interaction and by the artifact being read-only at runtime.
- `studio_updates_live_with_no_network`: editing history or moving the horizon updates all forecast
  lines and the ensemble band with no network request after initial load.
- `contract_swap_changes_zero_ts_logic`: regenerating `forecast_models.json` from a fresh export
  changes no `.ts`/`.tsx` logic file (ADR-D preserved).
- `accessibility_and_reduced_motion_hold`: every control is keyboard-reachable with a visible focus
  ring; `prefers-reduced-motion` disables studio animation; the forecast has a table/text equivalent.
- `build_and_checks_pass`: `cd web && npm run build` succeeds with zero console errors in light and
  dark themes, `npm test` passes, and `npm run check` passes.

## Reproducibility

- Export: run the forecast-model exporter (documented CLI, following the existing export pattern)
  to regenerate `web/public/data/forecast_models.json` deterministically from the committed data
  (fixed seed and the notebook hyperparameters).
- Parity: `pytest` generates/refreshes the golden fixtures (committed) and `cd web && npm test`
  asserts JS-vs-Python parity within the documented tolerances.
- Front: `cd web && npm ci && npm run build && npm run check`, then `npx serve out` to exercise the
  studio; responsiveness checked 320px to 1536px.

## Risks and Assumptions

- Risk: SARIMA re-forecasting from a perturbed state (MA innovations via a forward filter pass).
  Mitigation: the F1/F2/F3 fidelity ladder, with the delivered tier recorded and asserted, so the
  feature ships honestly at whatever fidelity is reproducible.
- Risk: multi-step recursive rollout accumulates error, so a JS/Python divergence at step one
  compounds over the horizon. Mitigation: parity is asserted over the full horizon, not just one
  step, and the rollout reuses the exact `create_features` parity module.
- Assumption: the exported LightGBM and GradientBoosting trees stay a reasonable artifact size.
  Mitigation: export only the node fields the scorer reads and load the artifact once; if size is a
  concern, quantize thresholds/leaf values to a documented precision within the parity tolerance.
- Risk: cross-language floating-point differences. Mitigation: tolerances are absolute and
  documented per model, and the exporter emits full-precision values.
- Assumption: dragging the last `K` observed points is an intuitive control and `K` bounded by the
  longest lag/window is enough to make every model respond. Mitigation: `K` is derived from the
  exported feature config, not hardcoded.
- Assumption: the studio depends on SP1 having landed (the shared tree primitive, the web test
  runner, and the contract-loader pattern). Mitigation: SP2 is sequenced after SP1.

## Alternatives Considered

- **Precompute a grid of forecasts and interpolate.** Rejected: it cannot answer an arbitrary
  perturbation and reads as canned, the static feel the studio exists to remove.
- **Keep ARIMA/SARIMA as static baselines from the start.** Rejected as the target: the owner chose
  full live (option C); static SARIMA is only the F3 floor of the fidelity ladder, not the plan.
- **Serve the models via the existing FastAPI backend.** Rejected: requires an always-on Python
  backend, contradicting the browser-side preference and the static-export architecture.
- **Run the models via an ONNX runtime.** Rejected: adds a multi-megabyte WASM runtime and does not
  cover the statsmodels ARIMA/SARIMA recursions, which still need bespoke handling.
- **Let the visitor upload their own series to forecast.** Rejected: the models are fit to the
  global daily-mean series, so transferring them to an arbitrary uploaded series is of questionable
  validity; the perturbation interaction gives the "touch the data" feel honestly instead.
