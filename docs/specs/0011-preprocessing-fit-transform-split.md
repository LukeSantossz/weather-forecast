# SPEC: fix(preprocessing): separate fit/transform to prevent scaling leakage

## Problem
`normalize_numeric_features` only fits-and-transforms in a single step, so any train/test or inference flow that reuses the pipeline refits the `MinMaxScaler` on data it must not see, leaking distribution information.

## Design Decision
Add a pure transform-only function `transform_numeric_features(df, scaler, cols_to_scale) -> pd.DataFrame` that applies an already-fitted `MinMaxScaler` via `scaler.transform` and never calls `fit`. Keep `normalize_numeric_features` unchanged as the fit-and-transform path that returns the fitted scaler and the scaled-column list, which are exactly the artifacts a caller feeds back into the transform path. The fitted scaler is already returned and is picklable, so no new persistence code is needed; a test locks in that a pickle round-trip reproduces the transform. This is the minimal separation that removes the leakage at its root while preserving the existing API.

## Alternatives Considered
- **Split `run_preprocessing_pipeline` into `fit_preprocessing_pipeline` + `transform_preprocessing_pipeline`, aligning the one-hot encoder columns across splits.** Rejected for this issue: broader than the stated defect and its acceptance criteria, adds encoder column-alignment complexity, and belongs with model-persistence (#15) and serving (#16), where a persisted, versioned transform is actually consumed. Adding it now would be unrequested abstraction.
- **Add a `scaler` / `fit: bool` parameter to `normalize_numeric_features` (one function, two modes).** Rejected: overloads a single function with two responsibilities and a mutually-exclusive parameter pair (`exclude_cols` used only when fitting vs `scaler` used only when transforming), which is easy to misuse. A separate, single-purpose function is clearer.
- **Wrap scaling in a scikit-learn `Pipeline` / `ColumnTransformer`.** Rejected: introduces a heavier abstraction and changes the artifacts contract for no benefit at the current pipeline size; the existing functions already return the fitted estimator.

## Scope
- Includes:
  - New `transform_numeric_features(df, scaler, cols_to_scale) -> pd.DataFrame` in `src/preprocessing.py` that applies a previously fitted scaler and never calls `fit`; does not modify the input in place; raises a clear `ValueError` if a column in `cols_to_scale` is absent from `df` (no silent drop, preserving train/serve symmetry).
  - Tests covering the acceptance criteria below.
  - Docstring for the new function, consistent with the module's existing style.
- Does NOT include:
  - Splitting `run_preprocessing_pipeline` into fit/transform stages.
  - A transform-only path for the one-hot encoder or column alignment across splits.
  - Persisting the scaler to disk (belongs to #15 model-persistence).
  - Any change to `normalize_numeric_features`'s signature or behavior.

## Acceptance Criteria
- `transform_numeric_features_applies_fitted_scaler_without_refitting`: transforming a frame with a scaler fitted on a train split produces values equal to `scaler.transform(df[cols_to_scale])` and leaves the scaler's fitted attributes (`data_min_`, `data_max_`) unchanged.
- `transform_of_out_of_bounds_holdout_exceeds_unit_interval`: after fitting on a train split, transforming a held-out split whose values fall outside the training min/max yields transformed values `< 0` or `> 1`, demonstrating that the holdout was not seen during fit (no leakage).
- `fitted_scaler_is_serializable_and_reproduces_transform`: `pickle.loads(pickle.dumps(scaler))` transforms an input identically to the original scaler.
- `transform_numeric_features_raises_when_column_missing`: a `cols_to_scale` entry absent from `df` raises `ValueError`.
- `existing_preprocessing_tests_still_pass`: the current `tests/test_preprocessing.py` suite passes unchanged.

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_preprocessing.py -q`. Deterministic: `MinMaxScaler` is a closed-form min/max fit with no randomness, so no seed is required. Versions: scikit-learn 1.7.2, pandas per `requirements.txt`, Python 3.10.

## Risks and Assumptions
- Assumption: callers obtain `cols_to_scale` from the fit path's returned column list, keeping the same columns in the same order across fit and transform. Invalidated if a caller passes a different or reordered column set.
- Assumption: the transform path receives every column the scaler was fitted on; a missing column is an error, not a silent skip.
- Low risk: the change is purely additive; `normalize_numeric_features`, `run_preprocessing_pipeline`, and the artifacts contract are untouched, so existing behavior cannot regress.
- Not ADR-worthy: the decision is easily reversible (an additive function) and not surprising; no `docs/adr/` entry is proposed. Final call rests with the Developer at the Gate.
