"""Parquet I/O helpers that avoid pandas' PyArrowImpl (duplicate extension registration in Jupyter)."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


def write_dataframe_parquet(
    df: pd.DataFrame,
    path: str | Path,
    *,
    preserve_index: bool = False,
) -> Path:
    """
    Write a DataFrame to Parquet using PyArrow directly.

    Using ``pyarrow.parquet.write_table`` avoids ``pandas.io.parquet.PyArrowImpl``,
    which can raise ``ArrowKeyError: pandas.period already defined`` when the
    Jupyter kernel has re-imported pandas/pyarrow (e.g. autoreload).
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    table = pa.Table.from_pandas(df, preserve_index=preserve_index)
    pq.write_table(table, path)
    return path
