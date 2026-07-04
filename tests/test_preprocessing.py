"""Unit tests for src/preprocessing.py."""

import pickle
import warnings

import numpy as np
import pandas as pd
import pytest

from src.preprocessing import (
    split_feature_types,
    impute_missing_values,
    detect_outliers_iqr,
    treat_outliers_iqr,
    normalize_numeric_features,
    transform_numeric_features,
    encode_categorical_features,
    align_to_encoded_columns,
    run_preprocessing_pipeline,
)


@pytest.fixture
def sample_df() -> pd.DataFrame:
    """Create a sample DataFrame for testing."""
    return pd.DataFrame({
        "temperature": [20.0, 25.0, np.nan, 30.0, 100.0],
        "humidity": [50, 60, 70, np.nan, 80],
        "city": ["A", "B", np.nan, "A", "C"],
        "country": ["X", "X", "Y", "Y", "Z"],
    })


@pytest.fixture
def numeric_df() -> pd.DataFrame:
    """Create a numeric-only DataFrame for testing."""
    return pd.DataFrame({
        "value1": [1.0, 2.0, 3.0, 4.0, 100.0],
        "value2": [10.0, 20.0, 30.0, 40.0, 50.0],
    })


class TestSplitFeatureTypes:
    """Tests for split_feature_types function."""

    def test_splits_correctly(self, sample_df: pd.DataFrame) -> None:
        categorical, numerical = split_feature_types(sample_df)

        assert "city" in categorical
        assert "country" in categorical
        assert "temperature" in numerical
        assert "humidity" in numerical

    def test_empty_dataframe(self) -> None:
        df = pd.DataFrame()
        categorical, numerical = split_feature_types(df)

        assert len(categorical) == 0
        assert len(numerical) == 0

    def test_only_numeric(self, numeric_df: pd.DataFrame) -> None:
        categorical, numerical = split_feature_types(numeric_df)

        assert len(categorical) == 0
        assert len(numerical) == 2

    def test_split_feature_types_does_not_warn_on_text_columns(self) -> None:
        df = pd.DataFrame({"text": ["a", "b"], "num": [1, 2]})
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            split_feature_types(df)
        assert not any("select_dtypes" in str(w.message) for w in caught), [
            str(w.message) for w in caught
        ]

    def test_split_feature_types_classifies_text_as_categorical(self) -> None:
        df = pd.DataFrame({"text": ["a", "b"], "num": [1, 2]})
        categorical, numerical = split_feature_types(df)

        assert "text" in categorical
        assert "num" in numerical


class TestImputeMissingValues:
    """Tests for impute_missing_values function."""

    def test_imputes_numeric_with_median(self, sample_df: pd.DataFrame) -> None:
        result = impute_missing_values(
            sample_df, ["temperature", "humidity"], []
        )

        assert result["temperature"].isna().sum() == 0
        assert result["humidity"].isna().sum() == 0

    def test_imputes_categorical_with_mode(self, sample_df: pd.DataFrame) -> None:
        result = impute_missing_values(sample_df, [], ["city"])

        assert result["city"].isna().sum() == 0
        assert result.loc[2, "city"] == "A"  # mode is "A"

    def test_does_not_modify_original(self, sample_df: pd.DataFrame) -> None:
        original_nulls = sample_df["temperature"].isna().sum()
        _ = impute_missing_values(sample_df, ["temperature"], [])

        assert sample_df["temperature"].isna().sum() == original_nulls

    def test_handles_missing_columns(self, sample_df: pd.DataFrame) -> None:
        result = impute_missing_values(
            sample_df, ["nonexistent"], ["also_nonexistent"]
        )

        assert result.shape == sample_df.shape


class TestDetectOutliersIqr:
    """Tests for detect_outliers_iqr function."""

    def test_returns_bounds_dict(self, numeric_df: pd.DataFrame) -> None:
        bounds = detect_outliers_iqr(numeric_df, ["value1", "value2"])

        assert isinstance(bounds, dict)
        assert "value1" in bounds
        assert "value2" in bounds

    def test_bounds_are_tuples(self, numeric_df: pd.DataFrame) -> None:
        bounds = detect_outliers_iqr(numeric_df, ["value1"])

        assert isinstance(bounds["value1"], tuple)
        assert len(bounds["value1"]) == 2

    def test_custom_multiplier(self, numeric_df: pd.DataFrame) -> None:
        bounds_default = detect_outliers_iqr(numeric_df, ["value1"], iqr_multiplier=1.5)
        bounds_wide = detect_outliers_iqr(numeric_df, ["value1"], iqr_multiplier=3.0)

        assert bounds_wide["value1"][0] < bounds_default["value1"][0]
        assert bounds_wide["value1"][1] > bounds_default["value1"][1]

    def test_detect_outliers_iqr_omits_zero_width_columns(self) -> None:
        df = pd.DataFrame({
            "zero_inflated": [0, 0, 0, 0, 0, 0, 0, 0, 0, 5.0, 10.0],
        })

        bounds = detect_outliers_iqr(df, ["zero_inflated"])

        assert "zero_inflated" not in bounds

    def test_zero_inflated_column_survives_outlier_treatment(self) -> None:
        df = pd.DataFrame({
            "zero_inflated": [0, 0, 0, 0, 0, 0, 0, 0, 0, 5.0, 10.0],
        })

        bounds = detect_outliers_iqr(df, ["zero_inflated"])
        result = treat_outliers_iqr(df, bounds)

        assert result["zero_inflated"].max() == 10.0
        assert 5.0 in result["zero_inflated"].values


class TestTreatOutliersIqr:
    """Tests for treat_outliers_iqr function."""

    def test_clips_values(self) -> None:
        df = pd.DataFrame({"value": [1.0, 2.0, 3.0, 100.0]})
        bounds = {"value": (0.0, 10.0)}

        result = treat_outliers_iqr(df, bounds, strategy="clip")

        assert result["value"].max() == 10.0

    def test_does_not_modify_original(self) -> None:
        df = pd.DataFrame({"value": [1.0, 2.0, 100.0]})
        bounds = {"value": (0.0, 10.0)}

        _ = treat_outliers_iqr(df, bounds)

        assert df["value"].max() == 100.0

    def test_invalid_strategy_raises(self) -> None:
        df = pd.DataFrame({"value": [1.0, 2.0]})
        bounds = {"value": (0.0, 10.0)}

        with pytest.raises(ValueError, match="Unsupported outlier strategy"):
            treat_outliers_iqr(df, bounds, strategy="remove")  # type: ignore


class TestNormalizeNumericFeatures:
    """Tests for normalize_numeric_features function."""

    def test_scales_to_0_1(self, numeric_df: pd.DataFrame) -> None:
        result, scaler, cols = normalize_numeric_features(
            numeric_df, ["value1", "value2"]
        )

        assert result["value1"].min() >= 0.0
        assert result["value1"].max() <= 1.0
        assert result["value2"].min() >= 0.0
        assert result["value2"].max() <= 1.0

    def test_returns_scaler(self, numeric_df: pd.DataFrame) -> None:
        _, scaler, _ = normalize_numeric_features(numeric_df, ["value1"])

        assert scaler is not None

    def test_excludes_columns(self, numeric_df: pd.DataFrame) -> None:
        result, _, scaled_cols = normalize_numeric_features(
            numeric_df, ["value1", "value2"], exclude_cols=["value2"]
        )

        assert "value1" in scaled_cols
        assert "value2" not in scaled_cols
        assert result["value2"].equals(numeric_df["value2"])

    def test_does_not_modify_original(self, numeric_df: pd.DataFrame) -> None:
        original_max = numeric_df["value1"].max()
        _ = normalize_numeric_features(numeric_df, ["value1"])

        assert numeric_df["value1"].max() == original_max


class TestTransformNumericFeatures:
    """Tests for transform_numeric_features function (fit/transform split, #8)."""

    def test_transform_applies_fitted_scaler_without_refitting(self) -> None:
        train = pd.DataFrame({"value1": [1.0, 2.0, 3.0, 4.0, 5.0]})
        _, scaler, cols = normalize_numeric_features(train, ["value1"])

        holdout = pd.DataFrame({"value1": [2.5, 4.5]})
        data_min_before = scaler.data_min_.copy()
        data_max_before = scaler.data_max_.copy()

        result = transform_numeric_features(holdout, scaler, cols)

        expected = scaler.transform(holdout[cols])
        assert np.allclose(result[cols].to_numpy(), expected)
        # The scaler was not refit on the holdout.
        assert np.array_equal(scaler.data_min_, data_min_before)
        assert np.array_equal(scaler.data_max_, data_max_before)

    def test_transform_of_out_of_bounds_holdout_exceeds_unit_interval(self) -> None:
        train = pd.DataFrame({"value1": [1.0, 2.0, 3.0, 4.0, 5.0]})
        _, scaler, cols = normalize_numeric_features(train, ["value1"])

        # Holdout values fall outside the training [1, 5] range.
        holdout = pd.DataFrame({"value1": [-50.0, 200.0]})
        result = transform_numeric_features(holdout, scaler, cols)

        assert result["value1"].min() < 0.0
        assert result["value1"].max() > 1.0

    def test_fitted_scaler_is_serializable_and_reproduces_transform(self) -> None:
        train = pd.DataFrame({"value1": [1.0, 2.0, 3.0, 4.0, 5.0]})
        _, scaler, cols = normalize_numeric_features(train, ["value1"])

        holdout = pd.DataFrame({"value1": [1.5, 3.5, 6.0]})
        restored = pickle.loads(pickle.dumps(scaler))

        original = transform_numeric_features(holdout, scaler, cols)
        reloaded = transform_numeric_features(holdout, restored, cols)

        assert np.allclose(original[cols].to_numpy(), reloaded[cols].to_numpy())

    def test_transform_numeric_features_raises_when_column_missing(self) -> None:
        train = pd.DataFrame({"value1": [1.0, 2.0, 3.0], "value2": [4.0, 5.0, 6.0]})
        _, scaler, cols = normalize_numeric_features(train, ["value1", "value2"])

        holdout_missing = pd.DataFrame({"value1": [1.5, 2.5]})

        with pytest.raises(ValueError, match="value2"):
            transform_numeric_features(holdout_missing, scaler, cols)

    def test_transform_does_not_modify_original(self) -> None:
        train = pd.DataFrame({"value1": [1.0, 2.0, 3.0, 4.0, 5.0]})
        _, scaler, cols = normalize_numeric_features(train, ["value1"])

        holdout = pd.DataFrame({"value1": [2.0, 4.0]})
        original_values = holdout["value1"].copy()

        _ = transform_numeric_features(holdout, scaler, cols)

        assert holdout["value1"].equals(original_values)


class TestEncodeCategoricalFeatures:
    """Tests for encode_categorical_features function."""

    def test_creates_dummy_columns(self, sample_df: pd.DataFrame) -> None:
        result = encode_categorical_features(sample_df, ["city"])

        assert "city_A" in result.columns or "city" not in result.columns
        assert "city" not in result.columns

    def test_handles_empty_list(self, sample_df: pd.DataFrame) -> None:
        result = encode_categorical_features(sample_df, [])

        assert result.shape == sample_df.shape

    def test_encode_drops_columns_above_threshold(self) -> None:
        df = pd.DataFrame({
            "id": [f"v{i}" for i in range(60)],
            "cat": ["A"] * 30 + ["B"] * 30,
        })

        result = encode_categorical_features(df, ["id", "cat"], max_cardinality=50)

        # High-cardinality "id" (60 distinct) is dropped, not exploded.
        assert "id" not in result.columns
        assert not any(c.startswith("id_") for c in result.columns)
        # Low-cardinality "cat" is one-hot encoded.
        assert "cat_A" in result.columns
        assert "cat_B" in result.columns

    def test_encode_threshold_is_configurable(self) -> None:
        df = pd.DataFrame({
            "id": [f"v{i}" for i in range(60)],
            "cat": ["A"] * 30 + ["B"] * 30,
        })

        result = encode_categorical_features(df, ["id", "cat"], max_cardinality=100)

        # Raising the threshold above 60 lets "id" be one-hot encoded.
        assert any(c.startswith("id_") for c in result.columns)


class TestAlignToEncodedColumns:
    """Tests for align_to_encoded_columns (deterministic inference, #9)."""

    def test_align_to_encoded_columns_handles_unseen_categories(self) -> None:
        train = pd.DataFrame({"city": ["A", "B"]})
        encoded_train = encode_categorical_features(train, ["city"], max_cardinality=50)
        expected_columns = list(encoded_train.columns)  # city_A, city_B

        holdout = pd.DataFrame({"city": ["A", "C"]})  # "C" is unseen
        encoded_holdout = encode_categorical_features(
            holdout, ["city"], max_cardinality=50
        )

        aligned = align_to_encoded_columns(encoded_holdout, expected_columns)

        # Exactly the training columns, in order; unseen "city_C" dropped.
        assert list(aligned.columns) == expected_columns
        # The missing "city_B" is zero-filled deterministically.
        assert aligned["city_B"].sum() == 0
        assert aligned.shape == (2, 2)


class TestRunPreprocessingPipeline:
    """Tests for run_preprocessing_pipeline function."""

    def test_returns_cleaned_df_and_artifacts(self, sample_df: pd.DataFrame) -> None:
        result, artifacts = run_preprocessing_pipeline(sample_df)

        assert isinstance(result, pd.DataFrame)
        assert isinstance(artifacts, dict)

    def test_artifacts_contain_expected_keys(self, sample_df: pd.DataFrame) -> None:
        _, artifacts = run_preprocessing_pipeline(sample_df)

        expected_keys = [
            "categorical_cols",
            "numerical_cols",
            "iqr_bounds",
            "exclude_from_normalize",
            "minmax_scaler",
            "minmax_columns",
            "output_columns",
        ]
        for key in expected_keys:
            assert key in artifacts

    def test_pipeline_threads_and_records_threshold(
        self, sample_df: pd.DataFrame
    ) -> None:
        result, artifacts = run_preprocessing_pipeline(sample_df, max_cardinality=1)

        # Threshold is recorded and applied: city/country (3 distinct each) are
        # dropped rather than one-hot encoded.
        assert artifacts["max_cardinality"] == 1
        assert not any(c.startswith("city_") for c in result.columns)
        assert not any(c.startswith("country_") for c in result.columns)

    def test_no_missing_values_after(self, sample_df: pd.DataFrame) -> None:
        result, _ = run_preprocessing_pipeline(sample_df)

        # Only check numeric columns that should have been imputed
        numeric_cols = result.select_dtypes(include=["number"]).columns
        for col in numeric_cols:
            assert result[col].isna().sum() == 0

    def test_does_not_modify_original(self, sample_df: pd.DataFrame) -> None:
        original_shape = sample_df.shape
        original_nulls = sample_df.isna().sum().sum()

        _ = run_preprocessing_pipeline(sample_df)

        assert sample_df.shape == original_shape
        assert sample_df.isna().sum().sum() == original_nulls
