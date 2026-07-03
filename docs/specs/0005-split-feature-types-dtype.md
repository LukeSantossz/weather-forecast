# SPEC 0005 — fix(preprocessing): harden split_feature_types against pandas str/object dtype migration

## Problem
`split_feature_types` detects categorical columns via `select_dtypes(include=["object", "category"])`. On pandas 3.x, text columns default to the new "str" dtype and are matched only through a deprecated object-compatibility shim (emits `Pandas4Warning`); once removed, no text column is detected as categorical, silently disabling mode-imputation and one-hot encoding.

## Design Decision
Include the pandas-3 "str" dtype explicitly, version-gated: `["object", "category", "str"]` on pandas >= 3, `["object", "category"]` on pandas 2 (where text is object and "str" is not a valid alias). The same columns are selected; the deprecation shim is no longer used.

## Scope
- Includes: a version-gated text-dtype include list used by `split_feature_types`; a regression test asserting no select_dtypes deprecation warning, plus a guard that text stays categorical.
- Does NOT include: pinning pandas (that is #10); changing any other function or behavior; new columns.

## Acceptance Criteria
- Calling `split_feature_types` on a text-containing DataFrame emits no `select_dtypes` deprecation warning.
- A text column is still classified as categorical; a numeric column as numerical.
- The full existing suite still passes, and its pre-existing select_dtypes deprecation warnings disappear.

## Reproducibility
`./.venv/Scripts/python -m pytest tests/ -q`. Deterministic.

## Risks and Assumptions
Adding "str" selects the same columns as the shim on pandas 3 (verified empirically); on pandas 2 text is object dtype so the un-gated list is correct. No behavior change; low risk.
