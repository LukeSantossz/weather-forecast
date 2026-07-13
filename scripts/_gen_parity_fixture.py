"""Regenerate tests/fixtures/anomaly_parity.json: Python reference outputs for the browser
inference parity tests (Task 4/5 of the SP1 anomaly checker).

For a fixed set of raw 5-feature inputs, records the standardized vectors (median-fill then
StandardScaler), the Isolation Forest ``score_samples`` and ``predict`` labels, and the z-score
and its verdict. Everything is derived from ``weather_forecast.anomaly.fit_anomaly_models``, the
same single deterministic fit that ``build_anomaly_model`` serializes into the shipped
``anomaly_model.json``, so the JS reimplementation is checked against exactly the model the
browser loads. The web vitest parity tests assert the JS output matches these values to 1e-6.
Deterministic (seed 42); rerun together with the exported artifact after any change to the
committed data, the fit, or the input set.

    PYTHONPATH=src python scripts/_gen_parity_fixture.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from weather_forecast.anomaly import fit_anomaly_models
from weather_forecast.data_loader import load_raw_weather

# Fixed raw inputs in feature order (temperature_celsius, humidity, wind_kph, pressure_mb,
# precip_mm), spanning a normal reading, a hot-dry extreme, a cold-wet extreme, and a
# missing-temperature case (to exercise the median/mu fills).
INPUTS: list[list[float]] = [
    [15.0, 60.0, 10.0, 1013.0, 0.0],
    [45.0, 5.0, 2.0, 990.0, 0.0],
    [-30.0, 95.0, 50.0, 1040.0, 30.0],
    [float("nan"), 50.0, 12.0, 1010.0, 1.0],
]


def build_fixture(root: Path) -> dict:
    df = load_raw_weather(root)
    fit = fit_anomaly_models(df)
    medians = fit.medians.to_numpy()

    raw = np.array(INPUTS, dtype=float)
    # IF path: median-fill per column, then the fitted StandardScaler. Transform through a
    # named DataFrame so the scaler sees the same feature names it was fitted with.
    filled = pd.DataFrame(np.where(np.isnan(raw), medians, raw), columns=fit.features)
    std = fit.scaler.transform(filled)

    # z-score path: temperature only, missing filled with the population mean (mu).
    z = [((row[0] if row[0] == row[0] else fit.mu) - fit.mu) / fit.sigma for row in INPUTS]

    # Serialize missing inputs as JSON null (not the non-standard NaN token) so the browser
    # test can JSON.parse the fixture; the JS scorer treats a non-finite value as missing,
    # matching the median/mu fill above.
    inputs_json = [[None if x != x else x for x in row] for row in INPUTS]

    return {
        "inputs": inputs_json,
        "standardized": std.tolist(),
        "if_score_samples": fit.forest.score_samples(std).tolist(),
        "if_predict": fit.forest.predict(std).tolist(),
        "z": z,
        "z_is_anomaly": [abs(v) > 3.0 for v in z],
    }


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    fixture = build_fixture(root)
    out = root / "tests" / "fixtures" / "anomaly_parity.json"
    out.parent.mkdir(exist_ok=True)
    # allow_nan=False guards against any non-finite value silently producing invalid JSON.
    out.write_text(json.dumps(fixture, indent=2, allow_nan=False) + "\n")
    print(f"wrote {out.relative_to(root)} ({len(fixture['inputs'])} inputs)")


if __name__ == "__main__":
    main()
