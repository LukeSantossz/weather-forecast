# SPEC: fix(preprocessing): control high-cardinality one-hot dimensionality

## Problem
`encode_categorical_features` one-hot encodes every categorical column, including identifier-like fields (`location_name`, `country`, an unparsed `last_updated`), exploding the feature matrix to tens of thousands of columns and producing a schema that misaligns whenever an unseen category appears at inference time.

## Design Decision
Add a configurable `max_cardinality` threshold to `encode_categorical_features`: columns whose distinct-value count is at or below the threshold are one-hot encoded; columns above it are identifier-like and dropped from the encoded output, yielding a bounded feature space. Add a transform-only helper `align_to_encoded_columns(df, expected_columns)` that reindexes an encoded frame to a fixed training column set (zero-filling missing categories, dropping unseen ones), so inference is deterministic. This mirrors the fit/transform split introduced for the scaler in #8: the fit path records the output columns (already in `run_preprocessing_pipeline`'s `output_columns` artifact) and the transform path aligns to them.

## Alternatives Considered
- **Encode high-cardinality columns with pandas `category` dtype instead of dropping.** Rejected here: `category` dtype does not produce a numeric feature matrix (the pipeline's contract) and its usefulness is model-specific (LightGBM only); it belongs to the model layer, not this boundary cleaner. Kept as a future option.
- **Hashing or target encoding for high-cardinality columns.** Rejected: adds a stateful encoder and dependencies for no current consumer (the cleaned Parquet is a demo export per EVO-1(b)); over-engineered for a bounded-schema fix.
- **Keep unbounded one-hot but exclude a hard-coded identifier list.** Rejected: brittle and dataset-specific; a cardinality threshold generalizes and stays configurable.

## Scope
- Includes:
  - `encode_categorical_features(df, categorical_cols, max_cardinality=50)`: one-hot only columns with `nunique <= max_cardinality`; drop the rest; unchanged return type (a DataFrame); copy-on-write.
  - `align_to_encoded_columns(df, expected_columns) -> pd.DataFrame`: reindex to `expected_columns`, `fill_value=0`, preserving order (drops unseen, zero-fills missing).
  - Thread `max_cardinality` through `run_preprocessing_pipeline` and record it in the artifacts dict.
  - Tests for the acceptance criteria below.
- Does NOT include:
  - `category`-dtype / hashing / target encoding paths.
  - Persisting the encoder to disk (belongs to #15 model-persistence).
  - Parsing `last_updated` inside the notebook (covered by #7 at the loader boundary).
  - Any change to scaling, imputation, or outlier handling.

## Acceptance Criteria
- `encode_drops_columns_above_threshold`: a frame with a categorical column of `nunique > max_cardinality` produces no dummy columns for it and drops the raw column, while a low-cardinality column is one-hot encoded.
- `encode_threshold_is_configurable`: the same high-cardinality column IS one-hot encoded when `max_cardinality` is raised above its distinct count.
- `align_to_encoded_columns_handles_unseen_categories`: encoding a holdout with an unseen category then aligning to the training columns yields exactly the training columns, with the unseen column dropped and the missing category column zero-filled.
- `pipeline_threads_and_records_threshold`: `run_preprocessing_pipeline(df, max_cardinality=n)` passes `n` to the encoder and stores it in the artifacts dict.
- `existing_preprocessing_tests_pass`: the current `tests/test_preprocessing.py` suite passes (default threshold does not change small-sample behavior).

## Reproducibility
`.venv-run/Scripts/python.exe -m pytest tests/test_preprocessing.py -q`. Deterministic (counting distinct values and reindexing; no randomness). pandas per `requirements.txt`, Python 3.10.

## Risks and Assumptions
- Assumption: dropping identifier-like high-cardinality columns is acceptable for the bounded numeric feature space the pipeline promises; callers needing those columns raise `max_cardinality`. Invalidated if a specific model needs a high-cardinality field, which would use the `category`-dtype option (out of scope).
- Assumption: the default `max_cardinality=50` preserves current behavior for the existing small-sample tests (their categoricals have <= 3 distinct values).
- Low risk: additive helper plus a bounded default; existing signatures keep their return types.
