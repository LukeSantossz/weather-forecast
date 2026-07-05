"""Unit tests for weather_forecast.features."""

import numpy as np
import pandas as pd

from weather_forecast.features import (
    DEFAULT_LAGS,
    DEFAULT_ROLLING_WINDOWS,
    create_features,
)


def _daily(n: int = 60) -> pd.DataFrame:
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    return pd.DataFrame({"ds": dates, "y": np.arange(n, dtype=float)})


def test_create_features_produces_expected_columns() -> None:
    out = create_features(_daily())
    cols = set(out.columns)
    for lag in DEFAULT_LAGS:
        assert f"lag_{lag}" in cols
    for w in DEFAULT_ROLLING_WINDOWS:
        assert f"rolling_mean_{w}" in cols
        assert f"rolling_std_{w}" in cols
    for c in [
        "dayofweek",
        "month",
        "dayofyear",
        "weekofyear",
        "month_sin",
        "month_cos",
        "dow_sin",
        "dow_cos",
        "y",
    ]:
        assert c in cols


def test_lag_k_equals_target_shifted_by_k() -> None:
    df = _daily()
    out = create_features(df)
    expected = df.set_index("ds")["y"].shift(7)
    pd.testing.assert_series_equal(out["lag_7"], expected, check_names=False)


def test_rolling_uses_only_past_values() -> None:
    out = create_features(_daily())
    # shift(1).rolling(7): first non-NaN appears at positional index 7 (row 8).
    first_valid = out["rolling_mean_7"].reset_index(drop=True).first_valid_index()
    assert first_valid == 7


def test_cyclical_encodings_are_bounded() -> None:
    out = create_features(_daily())
    for c in ["month_sin", "month_cos", "dow_sin", "dow_cos"]:
        assert out[c].abs().max() <= 1.0


def test_lags_and_windows_are_overridable() -> None:
    out = create_features(_daily(), lags=(1,), rolling_windows=(3,))
    cols = set(out.columns)
    assert "lag_1" in cols and "lag_2" not in cols
    assert "rolling_mean_3" in cols and "rolling_mean_7" not in cols
    assert "rolling_std_3" in cols
