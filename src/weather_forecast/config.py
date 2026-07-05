"""Pipeline configuration, global seed, and reproducibility primitives.

Sub-module 1 of the pipeline-extraction epic (#14): a single, immutable source
of cross-cutting hyperparameters and the global random seed, so runs are
centrally configurable and reproducible.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, fields, replace

import numpy as np


@dataclass(frozen=True)
class PipelineConfig:
    """Cross-cutting pipeline hyperparameters and the global seed.

    Model-specific hyperparameters live with the ``models`` sub-module; this
    holds only the values shared across cleaning, splitting, and detection.
    """

    seed: int = 42
    iqr_multiplier: float = 1.5
    z_threshold: float = 3.0
    contamination: float = 0.02
    test_window_days: int = 30
    val_size: int = 30
    max_cardinality: int = 50

    @classmethod
    def from_dict(cls, overrides: dict) -> PipelineConfig:
        """Build a config from the defaults with ``overrides`` applied.

        Raises:
            ValueError: If ``overrides`` contains a field name not on the config.
        """
        known = {f.name for f in fields(cls)}
        unknown = set(overrides) - known
        if unknown:
            raise ValueError(f"unknown config keys: {sorted(unknown)}")
        return replace(cls(), **overrides)


def set_global_seed(seed: int) -> None:
    """Seed Python's ``random`` and ``numpy`` for reproducible runs.

    Estimators that carry their own randomness (scikit-learn, LightGBM) still
    receive an explicit ``random_state``/``seed`` at their call sites.
    """
    random.seed(seed)
    np.random.seed(seed)
