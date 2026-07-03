"""Unit tests for src/preprocessing.py."""

import numpy as np
import pandas as pd
import pytest

from src.preprocessing import (
    split_feature_types,
    impute_missing_values,
    detect_outliers_iqr,
    treat_outliers_iqr,
    normalize_numeric_features,
    encode_categorical_features,
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


class TestEncodeCategoricalFeatures:
    """Tests for encode_categorical_features function."""

    def test_creates_dummy_columns(self, sample_df: pd.DataFrame) -> None:
        result = encode_categorical_features(sample_df, ["city"])

        assert "city_A" in result.columns or "city" not in result.columns
        assert "city" not in result.columns

    def test_handles_empty_list(self, sample_df: pd.DataFrame) -> None:
        result = encode_categorical_features(sample_df, [])

        assert result.shape == sample_df.shape


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
