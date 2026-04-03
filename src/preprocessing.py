"""
Cleaning and preprocessing utilities for the weather dataset.

Pipeline: impute missing values → IQR bounds + clip → MinMax scale numerics → one-hot encode categoricals.
"""


from __future__ import annotations
from typing import Any
import pandas as pd
from sklearn.preprocessing import MinMaxScaler


def split_feature_types(df: pd.DataFrame) -> tuple[pd.Index, pd.Index]:
    """Split columns into categorical (object/category) and numeric (integer/float)."""
    categorical = df.select_dtypes(include=["object", "category"]).columns
    numerical = df.select_dtypes(include=["number"]).columns
    return categorical, numerical


def impute_missing_values(
    df: pd.DataFrame,
    numerical_cols: pd.Index | list[str],
    categorical_cols: pd.Index | list[str],
) -> pd.DataFrame:
    """Impute numeric columns with median; categorical with mode (fallback to empty string)."""
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
    """Return per-column IQR fences as (lower, upper)."""
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
    strategy: str = "clip",
) -> pd.DataFrame:
    """Cap values to IQR fences when strategy is ``clip``."""
    if strategy != "clip":
        raise ValueError(f"Unsupported outlier strategy: {strategy!r}. Use 'clip'.")
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
    Scale numeric columns to [0, 1] with MinMaxScaler.

    Columns in ``exclude_cols`` are left unchanged (e.g. coordinates or epoch ids).
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
    """One-hot encode categorical columns; original columns are replaced by dummies."""
    cols = [c for c in categorical_cols if c in df.columns]
    if not cols:
        return df
    return pd.get_dummies(df, columns=cols, drop_first=False, dummy_na=False)


def run_preprocessing_pipeline(
    df: pd.DataFrame,
    outliers_strategy: str = "clip",
    exclude_from_normalize: list[str] | None = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Run full preprocessing and return cleaned frame plus metadata for auditing.

    Default excludes from MinMax: ``last_updated_epoch``, ``latitude``, ``longitude``
    (keeps geographic scale interpretable; adjust as needed).
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
