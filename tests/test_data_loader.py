"""Unit tests for src/data_loader.py."""

import pandas as pd
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.data_loader import (
    load_raw_weather,
    add_region_column,
    get_column_or_raise,
    get_temperature_column,
    get_precipitation_column,
)


@pytest.fixture
def sample_weather_df() -> pd.DataFrame:
    """Create a sample weather DataFrame for testing."""
    return pd.DataFrame({
        "last_updated": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
        "temperature_celsius": [20.0, 22.0, 18.0],
        "humidity": [60, 65, 70],
        "timezone": ["America/New_York", "Europe/London", "Asia/Tokyo"],
    })


@pytest.fixture
def sample_df_with_continent() -> pd.DataFrame:
    """Create a DataFrame with continent column."""
    return pd.DataFrame({
        "last_updated": pd.to_datetime(["2024-01-01", "2024-01-02"]),
        "temperature_celsius": [20.0, 22.0],
        "continent": ["North America", "Europe"],
        "timezone": ["America/New_York", "Europe/London"],
    })


class TestLoadRawWeather:
    """Tests for load_raw_weather function."""

    def test_raises_file_not_found(self, tmp_path: Path) -> None:
        with pytest.raises(FileNotFoundError, match="Raw data not found"):
            load_raw_weather(tmp_path)

    def test_raises_on_missing_columns(self, tmp_path: Path) -> None:
        # Create a CSV with last_updated (so parse_dates works) but without
        # temperature_celsius, triggering the project's own validation.
        data_dir = tmp_path / "data" / "raw"
        data_dir.mkdir(parents=True)
        csv_path = data_dir / "GlobalWeatherRepository.csv"

        df = pd.DataFrame({
            "last_updated": ["2024-01-01", "2024-01-02"],
            "other_column": [1, 2],
        })
        df.to_csv(csv_path, index=False)

        with pytest.raises(ValueError, match="Missing required columns"):
            load_raw_weather(tmp_path)

    def test_loads_and_sorts_by_date(self, tmp_path: Path) -> None:
        data_dir = tmp_path / "data" / "raw"
        data_dir.mkdir(parents=True)
        csv_path = data_dir / "GlobalWeatherRepository.csv"

        df = pd.DataFrame({
            "last_updated": ["2024-01-03", "2024-01-01", "2024-01-02"],
            "temperature_celsius": [18.0, 20.0, 22.0],
        })
        df.to_csv(csv_path, index=False)

        result = load_raw_weather(tmp_path)

        assert result["last_updated"].is_monotonic_increasing

    def test_drops_rows_with_null_dates(self, tmp_path: Path) -> None:
        data_dir = tmp_path / "data" / "raw"
        data_dir.mkdir(parents=True)
        csv_path = data_dir / "GlobalWeatherRepository.csv"

        df = pd.DataFrame({
            "last_updated": ["2024-01-01", None, "2024-01-02"],
            "temperature_celsius": [20.0, 22.0, 18.0],
        })
        df.to_csv(csv_path, index=False)

        result = load_raw_weather(tmp_path)

        assert len(result) == 2
        assert result["last_updated"].isna().sum() == 0


class TestAddRegionColumn:
    """Tests for add_region_column function."""

    def test_uses_timezone_prefix(self, sample_weather_df: pd.DataFrame) -> None:
        result = add_region_column(sample_weather_df)

        assert "region" in result.columns
        assert result.loc[0, "region"] == "America"
        assert result.loc[1, "region"] == "Europe"
        assert result.loc[2, "region"] == "Asia"

    def test_prefers_continent_over_timezone(
        self, sample_df_with_continent: pd.DataFrame
    ) -> None:
        result = add_region_column(sample_df_with_continent)

        assert result.loc[0, "region"] == "North America"
        assert result.loc[1, "region"] == "Europe"

    def test_partial_null_continent_falls_back_to_timezone_per_row(self) -> None:
        df = pd.DataFrame({
            "continent": ["North America", None, "Europe"],
            "timezone": ["America/New_York", "Asia/Tokyo", "Europe/London"],
        })
        result = add_region_column(df)

        assert result.loc[0, "region"] == "North America"
        assert result.loc[1, "region"] == "Asia"
        assert result.loc[2, "region"] == "Europe"

    def test_uses_unknown_when_no_columns(self) -> None:
        df = pd.DataFrame({"temperature": [20.0, 22.0]})
        result = add_region_column(df)

        assert all(result["region"] == "Unknown")

    def test_does_not_modify_original(self, sample_weather_df: pd.DataFrame) -> None:
        original_cols = list(sample_weather_df.columns)
        _ = add_region_column(sample_weather_df)

        assert list(sample_weather_df.columns) == original_cols


class TestGetColumnOrRaise:
    """Tests for get_column_or_raise function."""

    def test_returns_first_match(self) -> None:
        df = pd.DataFrame({"temp_c": [1], "temperature": [2]})
        result = get_column_or_raise(df, ["temp_c", "temperature"], "temperature")

        assert result == "temp_c"

    def test_returns_second_if_first_missing(self) -> None:
        df = pd.DataFrame({"temperature": [1]})
        result = get_column_or_raise(df, ["temp_c", "temperature"], "temperature")

        assert result == "temperature"

    def test_raises_when_none_found(self) -> None:
        df = pd.DataFrame({"other": [1]})

        with pytest.raises(ValueError, match="No temperature column found"):
            get_column_or_raise(df, ["temp_c", "temperature"], "temperature")


class TestGetTemperatureColumn:
    """Tests for get_temperature_column function."""

    def test_finds_temperature_celsius(self) -> None:
        df = pd.DataFrame({"temperature_celsius": [20.0]})
        assert get_temperature_column(df) == "temperature_celsius"

    def test_finds_temp_c(self) -> None:
        df = pd.DataFrame({"temp_c": [20.0]})
        assert get_temperature_column(df) == "temp_c"

    def test_finds_temperature(self) -> None:
        df = pd.DataFrame({"temperature": [20.0]})
        assert get_temperature_column(df) == "temperature"

    def test_raises_when_not_found(self) -> None:
        df = pd.DataFrame({"humidity": [60]})

        with pytest.raises(ValueError, match="No temperature column found"):
            get_temperature_column(df)


class TestGetPrecipitationColumn:
    """Tests for get_precipitation_column function."""

    def test_finds_precip_mm(self) -> None:
        df = pd.DataFrame({"precip_mm": [10.0]})
        assert get_precipitation_column(df) == "precip_mm"

    def test_finds_precipitation_mm(self) -> None:
        df = pd.DataFrame({"precipitation_mm": [10.0]})
        assert get_precipitation_column(df) == "precipitation_mm"

    def test_raises_when_not_found(self) -> None:
        df = pd.DataFrame({"humidity": [60]})

        with pytest.raises(ValueError, match="No precipitation column found"):
            get_precipitation_column(df)
