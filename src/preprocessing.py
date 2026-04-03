"""
Cleaning and preprocessing utilities for the weather dataset.

Pipeline: impute missing values → IQR bounds + clip → MinMax scale numerics → one-hot encode categoricals.
"""

from __future__ import annotations
from typing import Any, Literal
import pandas as pd
from sklearn.preprocessing import MinMaxScaler


OutlierStrategy = Literal["clip"]


def split_feature_types(df: pd.DataFrame) -> tuple[pd.Index, pd.Index]:
    """
    Split DataFrame columns by data type.

    Args:
        df: Input DataFrame to analyze.

    Returns:
        Tuple of (categorical_columns, numerical_columns) as pandas Index objects.
        Categorical includes object and category dtypes; numerical includes all numeric dtypes.
    """
    categorical = df.select_dtypes(include=["object", "category"]).columns
    numerical = df.select_dtypes(include=["number"]).columns
    return categorical, numerical


def impute_missing_values(
    df: pd.DataFrame,
    numerical_cols: pd.Index | list[str],
    categorical_cols: pd.Index | list[str],
) -> pd.DataFrame:
    """
    Impute missing values in a DataFrame.

    Numeric columns are filled with their median; categorical columns
    are filled with their mode (fallback to empty string if no mode exists).

    Args:
        df: Input DataFrame (not modified in place).
        numerical_cols: Columns to impute with median.
        categorical_cols: Columns to impute with mode.

    Returns:
        New DataFrame with missing values imputed.
    """
    df = df.copy()
    for col in numerical_cols:
        if col not in df.columns:
            continue
        df[col] = df[col].fillna(df[col].median())
    for col in categorical_cols:
        if col not in df.columns:
            continue
        mode_series = df[col].mode()
        fill_value = mode_series.iloc[0] if len(mode_series) > 0 else ""
        df[col] = df[col].fillna(fill_value)
    return df


def detect_outliers_iqr(
    df: pd.DataFrame,
    numerical_cols: pd.Index | list[str],
    iqr_multiplier: float = 1.5,
) -> dict[str, tuple[float, float]]:
    """
    Compute IQR-based outlier fences for numeric columns.

    Args:
        df: Input DataFrame.
        numerical_cols: Columns to compute bounds for.
        iqr_multiplier: Multiplier for IQR range (default 1.5).

    Returns:
        Dictionary mapping column names to (lower_bound, upper_bound) tuples.
        Bounds are computed as Q1 - multiplier*IQR and Q3 + multiplier*IQR.
    """
    bounds: dict[str, tuple[float, float]] = {}
    for col in numerical_cols:
        if col not in df.columns:
            continue
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lower = float(q1 - iqr_multiplier * iqr)
        upper = float(q3 + iqr_multiplier * iqr)
        bounds[str(col)] = (lower, upper)
    return bounds


def treat_outliers_iqr(
    df: pd.DataFrame,
    bounds: dict[str, tuple[float, float]],
    strategy: OutlierStrategy = "clip",
) -> pd.DataFrame:
    """
    Treat outliers by capping values to IQR fences.

    Args:
        df: Input DataFrame (not modified in place).
        bounds: Per-column (lower, upper) bounds from detect_outliers_iqr.
        strategy: Treatment strategy. Currently only "clip" is supported.

    Returns:
        New DataFrame with outliers clipped to bounds.

    Raises:
        ValueError: If strategy is not supported.
    """
    if strategy != "clip":
        raise ValueError(f"Unsupported outlier strategy: {strategy!r}. Use 'clip'.")
    df = df.copy()
    for col, (low, high) in bounds.items():
        if col not in df.columns:
            continue
        df[col] = df[col].clip(lower=low, upper=high)
    return df


def normalize_numeric_features(
    df: pd.DataFrame,
    numerical_cols: pd.Index | list[str],
    exclude_cols: list[str] | None = None,
) -> tuple[pd.DataFrame, MinMaxScaler | None, list[str]]:
    """
    Scale numeric columns to [0, 1] using MinMaxScaler.

    Args:
        df: Input DataFrame (not modified in place).
        numerical_cols: Candidate columns for scaling.
        exclude_cols: Columns to skip (e.g., coordinates, epoch timestamps).

    Returns:
        Tuple of (scaled_df, fitted_scaler, list_of_scaled_columns).
        Returns (df, None, []) if no columns were scaled.
    """
    exclude_cols = exclude_cols or []
    cols_to_scale = [
        c for c in numerical_cols if c in df.columns and c not in exclude_cols
    ]
    if not cols_to_scale:
        return df, None, []

    scaler = MinMaxScaler()
    df = df.copy()
    df[cols_to_scale] = scaler.fit_transform(df[cols_to_scale])
    return df, scaler, cols_to_scale


def encode_categorical_features(
    df: pd.DataFrame,
    categorical_cols: pd.Index | list[str],
) -> pd.DataFrame:
    """
    One-hot encode categorical columns.

    Args:
        df: Input DataFrame (not modified in place).
        categorical_cols: Columns to encode.

    Returns:
        New DataFrame with original categorical columns replaced by dummy variables.
    """
    cols = [c for c in categorical_cols if c in df.columns]
    if not cols:
        return df
    return pd.get_dummies(df, columns=cols, drop_first=False, dummy_na=False)


def run_preprocessing_pipeline(
    df: pd.DataFrame,
    outliers_strategy: OutlierStrategy = "clip",
    exclude_from_normalize: list[str] | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Run the full preprocessing pipeline.

    Steps: impute missing → detect/treat outliers → normalize numerics → encode categoricals.

    Args:
        df: Raw input DataFrame (not modified in place).
        outliers_strategy: Strategy for outlier treatment (default "clip").
        exclude_from_normalize: Columns to exclude from MinMax scaling.
            Defaults to ["last_updated_epoch", "latitude", "longitude"].

    Returns:
        Tuple of (cleaned_df, artifacts_dict).

        artifacts_dict contains:
            - categorical_cols: Original categorical column names.
            - numerical_cols: Original numerical column names.
            - iqr_bounds: Per-column (lower, upper) outlier bounds.
            - exclude_from_normalize: Columns excluded from scaling.
            - minmax_scaler: Fitted MinMaxScaler instance (or None).
            - minmax_columns: List of columns that were scaled.
            - output_columns: Final column names after encoding.
    """
    artifacts: dict[str, Any] = {}
    df_clean = df.copy()

    categorical_cols, numerical_cols = split_feature_types(df_clean)
    categorical_cols = list(categorical_cols)
    numerical_cols = list(numerical_cols)
    artifacts["categorical_cols"] = categorical_cols
    artifacts["numerical_cols"] = numerical_cols

    df_clean = impute_missing_values(df_clean, numerical_cols, categorical_cols)

    bounds = detect_outliers_iqr(df_clean, numerical_cols)
    artifacts["iqr_bounds"] = bounds
    df_clean = treat_outliers_iqr(df_clean, bounds, strategy=outliers_strategy)

    exclude = exclude_from_normalize or [
        "last_updated_epoch",
        "latitude",
        "longitude",
    ]
    artifacts["exclude_from_normalize"] = exclude
    df_clean, scaler, scaled_cols = normalize_numeric_features(
        df_clean, numerical_cols, exclude_cols=exclude
    )
    artifacts["minmax_scaler"] = scaler
    artifacts["minmax_columns"] = scaled_cols

    df_clean = encode_categorical_features(df_clean, categorical_cols)
    artifacts["output_columns"] = list(df_clean.columns)

    return df_clean, artifacts
