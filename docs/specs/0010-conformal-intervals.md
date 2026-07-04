# SPEC 0010 — feat(conformal): split-conformal prediction intervals

## Problem
The forecast ships point predictions only; there is no calibrated,
distribution-free way to quantify their uncertainty as an interval (issue #31).

## Design Decision
Split-conformal on residual quantiles: add a pure, dependency-light
`src/conformal.py` module (calibration residuals -> conformal quantile ->
symmetric prediction interval -> empirical coverage check) as small,
composable functions. No notebook or dashboard integration in this phase.

## Scope
- Includes: `src/conformal.py` (`calibration_residuals`, `conformal_quantile`,
  `prediction_interval`, `empirical_coverage`) and `tests/test_conformal.py`.
- Does NOT include: notebook/dashboard wiring, non-split-conformal methods.

## Acceptance Criteria
- `calibration_residuals(y_true, y_pred)` returns `|y_true - y_pred|`
  element-wise as a `np.ndarray`.
- `conformal_quantile(residuals, alpha)` returns the split-conformal quantile
  using the finite-sample-corrected level `ceil((n + 1) * (1 - alpha)) / n`
  clipped to `[0, 1]`; raises `ValueError` when `residuals` is empty or when
  `alpha` is not in `(0, 1)`.
- `prediction_interval(point, q)` returns `(point - q, point + q)`, symmetric
  around `point`, for both scalar and array `point`.
- `empirical_coverage(y_true, lower, upper)` returns the fraction of `y_true`
  values within `[lower, upper]`.
- On a synthetic calibration/test split drawn from the same distribution
  (fixed seed), empirical coverage measured on the held-out test set is
  `>= (1 - alpha)` minus a small fixed tolerance.
- All tests in `tests/test_conformal.py` pass; no other test in the suite is
  affected.

## Reproducibility
`./.venv/Scripts/python -m pytest tests/test_conformal.py -q`.
Coverage test seed: `np.random.default_rng(20260703)`. Fully deterministic,
no external data required.

## Risks and Assumptions
- Assumption: "the standard split-conformal definition" is the order-statistic
  form used in the split-conformal literature (Vovk et al.; Lei et al. 2018) —
  the `k`-th smallest calibration residual with
  `k = min(ceil((n + 1) * (1 - alpha)), n)` — rather than a continuous
  interpolation quantile; `numpy.quantile`'s default or `"higher"` methods do
  not coincide with this order statistic in general, so the quantile is
  computed directly from the sorted residuals instead of via `numpy.quantile`.
- Assumption: a coverage-test tolerance of `0.03` absolute, with
  `n_cal = 1000` / `n_test = 2000` at the fixed seed above, is tight enough to
  catch a broken implementation while remaining stable (non-flaky) for that
  seed.
- No new dependency: implemented with `numpy` only (already a project
  dependency).
