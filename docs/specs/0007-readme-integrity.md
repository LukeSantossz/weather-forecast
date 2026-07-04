# SPEC 0007 — docs(readme): retract leakage-inflated metrics and correct README integrity issues

Spec-lite. This is a documentation-only, honesty-first change with no code impact,
addressing GitHub issue #19. It records the retraction decision and the greppable
checks that prove it landed.

## Problem

The README asserts forecasting accuracy and product claims that are not true: a
headline 0.19 °C RMSE (and a 0.24 °C ensemble, and a 75% improvement) inflated by
evaluation leakage (issue #20, still open); "prediction across 211 countries" that
implies per-country forecasts when the model produces a single global daily-mean
series; a SHAP section implying the temperature model when the SHAP work explains a
PM2.5 air-quality model; and an architecture diagram claiming both pipelines read a
shared cleaned Parquet when the notebooks read the raw CSV and the Parquet is an
orphaned export; plus a stale "37 tests" badge.

## Design Decision

Retract the leakage-inflated numbers and reword every dependent claim to honest,
verifiable statements, keep the `complete` Status badge (owner decision), and edit
only `README.md` (plus this spec).

## Alternatives Considered

- **Flip the Status badge to "under revision".** Rejected: the owner decided to keep
  `complete`. The codebase is complete; only specific metric claims were inflated, and
  those are retracted in place rather than by downgrading the whole project's status.
- **Delete the affected model rows from the results table.** Rejected: marking the
  LightGBM, GradientBoosting, and ensemble rows as `withdrawn` in place, with a link to
  issue #20, preserves the audit trail. Silent deletion would hide that the numbers
  ever existed and were retracted.
- **Keep 0.19 as a struck-through caveated mention.** Rejected: removing the literal
  number entirely is cleaner, so a plain `grep "0.19" README.md` returns nothing; the
  Known Issues retraction text carries the history without re-quoting the figure.

## Scope

- **Includes:** retracting the 0.19 / 0.24 / 75% claims from the tagline, What It Does,
  Engineering Decisions, results table and prose, Done list, and Known Issues; marking
  the four gradient-boosted / ensemble rows as `withdrawn` and adding a Known Issues
  entry that links #20; reframing the output as a global daily-mean signal built from
  211 countries' data (not per-country forecasts); labeling the SHAP work as a PM2.5
  air-quality model; correcting the architecture diagram and prose to the raw-CSV flow
  with the Parquet as an optional export (EVO-1(b)); refreshing the stale test count to
  the real number.
- **Does NOT include:** re-running the models or producing leakage-free metrics (that is
  issue #20); changing the `complete` Status badge; touching any file other than
  `README.md` and this spec; editing notebooks, `src/`, or tests; creating an ADR file
  for EVO-1(b); the phase-1 dashboard (spec 0006).

## Acceptance Criteria

- `grep -n "0.19" README.md` returns no line (no unqualified achievement claim; the
  retraction text does not re-quote the figure).
- `grep -n "0.24" README.md` and `grep -n "75%" README.md` each return no line.
- The Forecast Performance table keeps the Prophet (0.77), ARIMA (1.71), and SARIMA
  (1.13) rows and shows `withdrawn` for the LightGBM, GradientBoosting, Ensemble
  (Simple Avg), and Ensemble (Weighted) rows: `grep -c "withdrawn" README.md` is at
  least 4.
- A Known Issues entry documents the evaluation-leakage retraction and links issue #20:
  `grep -n "evaluation leakage" README.md` and `grep -n "issues/20" README.md` both
  return a line.
- The output is framed as a global daily-mean signal, not per-country forecasts:
  `grep -n "daily-mean" README.md` returns a line and
  `grep -n "prediction across 211 countries" README.md` returns no line.
- The SHAP work is labeled air-quality / PM2.5, not temperature:
  `grep -n "PM2.5" README.md` returns a line.
- The architecture reflects the raw-CSV flow: `grep -n "optional export" README.md`
  returns a line and `grep -n "single shared artifact" README.md` returns no line.
- The test count is current: `grep -n "tests-70" README.md` returns the badge line and
  `grep -n "70 passing" README.md` returns the Done line; `grep -n "37" README.md`
  returns no line (the stale count is gone everywhere).
- The Status badge stays `complete`: `grep -n "status-complete" README.md` returns a
  line.

## Reproducibility

- Test count: `python -m pytest tests/ -q` prints `70 passed` (verified with Python
  3.14.5, pytest 9.1.1). Per file: data_loader 20, preprocessing 27, parquet_io 5,
  dashboard_export 18.
- Claim verification: run the grep checks in Acceptance Criteria from the repository
  root against `README.md`.

## Risks and Assumptions

- Assumption: `EVO-1(b)` is the architecture-decision label from the audit for the
  raw-CSV flow; no ADR file exists yet, so the README names the decision without
  linking a file. Creating the ADR is out of scope.
- Assumption: issue #20 remains the tracking issue for the leakage-free re-run, and
  issue #19 is the retraction task this spec serves.
- Risk: when #20 lands corrected metrics, the `withdrawn` rows and the Known Issues
  entry must be updated; this spec covers only the retraction, not the re-run.
