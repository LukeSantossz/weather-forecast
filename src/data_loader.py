"""
Data loading utilities for the weather forecasting project.

Centralizes CSV loading, datetime parsing, and common column derivations
to avoid code repetition across notebooks.
"""

from __future__ import annotations
from pathlib import Path

import pandas as pd


def load_raw_weather(
    project_root: Path,
    filename: str = "GlobalWeatherRepository.csv",
) -> pd.DataFrame:
    """
    Load and parse the raw weather CSV.

    Args:
        project_root: Root directory of the project.
        filename: Name of the CSV file in data/raw/.

    Returns:
        DataFrame sorted by last_updated with datetime index parsed.

    Raises:
        FileNotFoundError: If the CSV file does not exist.
        ValueError: If required columns are missing.
    """
    raw_path = project_root / "data" / "raw" / filename
    if not raw_path.exists():
        raise FileNotFoundError(f"Raw data not found: {raw_path}")

    df = pd.read_csv(raw_path, parse_dates=["last_updated"])
    df["last_updated"] = pd.to_datetime(df["last_updated"], errors="coerce")

    required = ["last_updated", "temperature_celsius"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df.dropna(subset=["last_updated"]).copy()
    df = df.sort_values("last_updated").reset_index(drop=True)

    return df


def add_region_column(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add a 'region' column derived from continent or timezone.

    Uses the continent column if available and populated;
    otherwise extracts the area prefix from the IANA timezone.

    Args:
        df: Input DataFrame (not modified in place).

    Returns:
        DataFrame with 'region' column added.
    """
    df = df.copy()

    if "continent" in df.columns and df["continent"].notna().any():
        df["region"] = df["continent"].astype(str)
    elif "timezone" in df.columns:
        df["region"] = df["timezone"].astype(str).str.split("/").str[0]
    else:
        df["region"] = "Unknown"

    return df


def get_column_or_raise(
    df: pd.DataFrame,
    candidates: list[str],
    description: str,
) -> str:
    """
    Find the first available column from a list of candidates.

    Args:
        df: DataFrame to search.
        candidates: Ordered list of column name candidates.
        description: Human-readable description for error message.

    Returns:
        The first matching column name.

    Raises:
        ValueError: If none of the candidates exist in the DataFrame.
    """
    for col in candidates:
        if col in df.columns:
            return col
    raise ValueError(f"No {description} column found. Tried: {candidates}")


def get_temperature_column(df: pd.DataFrame) -> str:
    """Return the temperature column name from common candidates."""
    return get_column_or_raise(
        df,
        ["temperature_celsius", "temp_c", "temperature"],
        "temperature",
    )


def get_precipitation_column(df: pd.DataFrame) -> str:
    """Return the precipitation column name from common candidates."""
    return get_column_or_raise(
        df,
        ["precip_mm", "precipitation_mm", "precipitation", "precip_in"],
        "precipitation",
    )
