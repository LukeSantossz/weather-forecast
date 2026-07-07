"""Regenerate web/public/data/anomaly_model.json from the committed raw data.

Provenance helper for the SP1 browser anomaly checker: fits the anomaly models via
``weather_forecast.anomaly.build_anomaly_model`` on the committed raw weather CSV and writes
the serialized model to the web data contract. Deterministic (seed 42); rerun after any change
to the committed data or to ``build_anomaly_model``.

    PYTHONPATH=src python scripts/_gen_anomaly_model.py
"""

from __future__ import annotations

import json
from pathlib import Path

from weather_forecast.anomaly import build_anomaly_model
from weather_forecast.data_loader import load_raw_weather

# Aligns generated_at with the committed data contract (metrics/forecast generated 2026-07-05),
# since the model is fit on that same committed dataset.
GENERATED_AT = "2026-07-05T00:19:52Z"


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    df = load_raw_weather(root)
    model = build_anomaly_model(df, generated_at=GENERATED_AT)
    out = root / "web" / "public" / "data" / "anomaly_model.json"
    out.write_text(json.dumps(model, indent=2) + "\n")
    print(f"wrote {out.relative_to(root)} ({len(model['isolation_forest']['trees'])} trees)")


if __name__ == "__main__":
    main()
