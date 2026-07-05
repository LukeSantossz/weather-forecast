"""Unit tests for weather_forecast.config."""

import dataclasses

import numpy as np
import pytest

from weather_forecast.config import PipelineConfig, set_global_seed


class TestPipelineConfig:
    def test_pipeline_config_has_documented_defaults(self) -> None:
        c = PipelineConfig()
        assert c.seed == 42
        assert c.iqr_multiplier == 1.5
        assert c.z_threshold == 3.0
        assert c.contamination == 0.02
        assert c.test_window_days == 30
        assert c.val_size == 30
        assert c.max_cardinality == 50

    def test_from_dict_overrides_only_given_fields(self) -> None:
        c = PipelineConfig.from_dict({"seed": 7})
        assert c.seed == 7
        assert c.z_threshold == 3.0

    def test_from_dict_rejects_unknown_key(self) -> None:
        with pytest.raises(ValueError, match="unknown"):
            PipelineConfig.from_dict({"nope": 1})

    def test_config_is_immutable(self) -> None:
        c = PipelineConfig()
        with pytest.raises(dataclasses.FrozenInstanceError):
            c.seed = 1  # type: ignore[misc]


class TestSetGlobalSeed:
    def test_set_global_seed_makes_numpy_reproducible(self) -> None:
        set_global_seed(123)
        a = np.random.rand(5)
        set_global_seed(123)
        b = np.random.rand(5)
        assert np.allclose(a, b)
