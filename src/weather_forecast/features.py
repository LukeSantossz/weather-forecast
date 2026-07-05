"""Time-series feature engineering for the daily forecast.

Sub-module 2 of the pipeline-extraction epic (#14): the lag, rolling, calendar,
and cyclical features from ``notebooks/06``, as a pure, tested function.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
import pandas as pd

DEFAULT_LAGS = (1, 2, 3, 7, 14, 21)
DEFAULT_ROLLING_WINDOWS = (7, 14, 30)


def create_features(
    df: pd.DataFrame,
    *,
    lags: Sequence[int] = DEFAULT_LAGS,
    rolling_windows: Sequence[int] = DEFAULT_ROLLING_WINDOWS,
) -> pd.DataFrame:
    """Create lag, rolling, calendar, and cyclical features from a daily frame.

    Rolling statistics are computed on ``y.shift(1)`` so the current target never
    leaks into its own features. The result is indexed by ``ds`` with the leading
    NaN rows left intact; the caller decides how to drop them.

    Args:
        df: Daily frame with ``ds`` (datetime) and ``y`` columns.
        lags: Lag offsets (days) to build ``lag_<k>`` columns for.
        rolling_windows: Window sizes (days) for ``rolling_mean_/std_<w>``.

    Returns:
        A ``ds``-indexed DataFrame with ``y`` plus the engineered columns.
    """
    data = df.copy().set_index("ds")

    for lag in lags:
        data[f"lag_{lag}"] = data["y"].shift(lag)

    for window in rolling_windows:
        shifted = data["y"].shift(1)
        data[f"rolling_mean_{window}"] = shifted.rolling(window=window).mean()
        data[f"rolling_std_{window}"] = shifted.rolling(window=window).std()

    data["dayofweek"] = data.index.dayofweek
    data["month"] = data.index.month
    data["dayofyear"] = data.index.dayofyear
    data["weekofyear"] = data.index.isocalendar().week.astype(int)

    data["month_sin"] = np.sin(2 * np.pi * data["month"] / 12)
    data["month_cos"] = np.cos(2 * np.pi * data["month"] / 12)
    data["dow_sin"] = np.sin(2 * np.pi * data["dayofweek"] / 7)
    data["dow_cos"] = np.cos(2 * np.pi * data["dayofweek"] / 7)

    return data
