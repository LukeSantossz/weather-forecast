"""Unit tests for src/parquet_io.py."""

from pathlib import Path

import pandas as pd
import pytest

from weather_forecast.parquet_io import write_dataframe_parquet


@pytest.fixture
def sample_df() -> pd.DataFrame:
    """Create a small sample DataFrame for testing."""
    return pd.DataFrame(
        {
            "temperature_celsius": [20.0, 22.0, 18.0],
            "humidity": [60, 65, 70],
        }
    )


class TestWriteDataframeParquet:
    """Tests for write_dataframe_parquet function."""

    def test_writes_and_reads_back_equal(self, sample_df: pd.DataFrame, tmp_path: Path) -> None:
        out_path = write_dataframe_parquet(sample_df, tmp_path / "out.parquet")

        result = pd.read_parquet(out_path)

        pd.testing.assert_frame_equal(
            result.reset_index(drop=True), sample_df.reset_index(drop=True)
        )

    def test_creates_nested_directories(self, sample_df: pd.DataFrame, tmp_path: Path) -> None:
        nested_path = tmp_path / "a" / "b" / "out.parquet"

        result = write_dataframe_parquet(sample_df, nested_path)

        assert result.exists()

    def test_returns_path(self, sample_df: pd.DataFrame, tmp_path: Path) -> None:
        out_path = tmp_path / "out.parquet"

        result = write_dataframe_parquet(sample_df, out_path)

        assert isinstance(result, Path)
        assert result == out_path

    def test_preserve_index_true_keeps_index(self, sample_df: pd.DataFrame, tmp_path: Path) -> None:
        indexed_df = sample_df.set_index(pd.Index([10, 11, 12], name="row_id"))

        out_path = write_dataframe_parquet(
            indexed_df, tmp_path / "out.parquet", preserve_index=True
        )
        result = pd.read_parquet(out_path)

        assert result.index.name == "row_id"
        assert list(result.index) == [10, 11, 12]

    def test_preserve_index_false_drops_index(
        self, sample_df: pd.DataFrame, tmp_path: Path
    ) -> None:
        indexed_df = sample_df.set_index(pd.Index([10, 11, 12], name="row_id"))

        out_path = write_dataframe_parquet(
            indexed_df, tmp_path / "out.parquet", preserve_index=False
        )
        result = pd.read_parquet(out_path)

        assert result.index.name != "row_id"
        assert list(result.index) != [10, 11, 12]
