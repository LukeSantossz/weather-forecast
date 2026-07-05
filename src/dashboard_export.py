"""
Dashboard data-contract export module.

Builds the JSON data contract consumed by the static Next.js dashboard
(``web/``), per ``docs/specs/0006-visual-dashboard-phase1.md``. Phase 1 only
ships a deterministic, schema-valid, clearly-labeled *sample* snapshot: the
real-data reader is a later phase and is intentionally not implemented here.

Every ``build_*`` function is a pure function of its ``data_status`` and
``generated_at`` arguments (no ``datetime.now()``, no RNG), so output is
stable across runs and safe to assert on in tests.
"""

from __future__ import annotations

import copy
import functools
import json
import math
from pathlib import Path

from jsonschema import validate as _jsonschema_validate

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "schema"

_SCHEMA_VERSION = "1.0"


def _sample_only(build):
    """Guard: build_* produce sample data only. Reject any attempt to label their
    synthetic output as real (the real-data reader is not implemented)."""

    @functools.wraps(build)
    def wrapper(
        data_status: str = "sample",
        generated_at: str = "1970-01-01T00:00:00Z",
    ) -> dict:
        if data_status != "sample":
            raise ValueError(
                "build_* produce sample data only; data_status must be 'sample' "
                "(the real-data reader is not implemented)."
            )
        return build(data_status=data_status, generated_at=generated_at)

    return wrapper


@_sample_only
def build_meta(
    data_status: str = "sample",
    generated_at: str = "1970-01-01T00:00:00Z",
) -> dict:
    """
    Build the ``meta.json`` contract section.

    Args:
        data_status: Either "sample" or "real".
        generated_at: ISO-8601 timestamp recorded on the file.

    Returns:
        A dict matching ``schema/meta.schema.json``.
    """
    return {
        "schema_version": _SCHEMA_VERSION,
        "generated_at": generated_at,
        "data_status": data_status,
        "pipeline": {"source": "notebooks 04/06/07", "repo_commit": None},
        "disclaimer": "Sample snapshot for layout; not model output.",
    }


# --- forecast: deterministic global daily-mean series -----------------------

_HISTORY_DAYS = 90
_TEST_WINDOW_DAYS = 30
_SERIES_START_YEAR = 2023
_SERIES_START_MONTH = 1
_SERIES_START_DAY = 1

# (model_id, display name, deterministic offset applied to the true value)
_FORECAST_MODELS = (
    ("ensemble_weighted", "Ensemble (weighted)", 0.05),
    ("lightgbm", "LightGBM", 0.12),
    ("sarima", "SARIMA", -0.08),
    ("arima", "ARIMA", 0.31),
    ("prophet", "Prophet", -0.14),
)


def _series_date(day_index: int) -> str:
    """Return the ISO date for ``day_index`` days after the fixed series anchor."""
    from datetime import date, timedelta

    anchor = date(_SERIES_START_YEAR, _SERIES_START_MONTH, _SERIES_START_DAY)
    return (anchor + timedelta(days=day_index)).isoformat()


def _series_value(day_index: int) -> float:
    """
    Deterministic global-mean-ish temperature (celsius) for ``day_index``.

    A fixed sinusoid around 16C with a slow annual cycle and a faster ripple;
    intentionally not random so tests are stable.
    """
    seasonal = 6.0 * math.sin(2 * math.pi * day_index / 365.0)
    ripple = 0.6 * math.sin(day_index / 3.0)
    return round(16.03 + seasonal + ripple, 2)


@_sample_only
def build_forecast(
    data_status: str = "sample",
    generated_at: str = "1970-01-01T00:00:00Z",
) -> dict:
    """
    Build the ``forecast.json`` contract section.

    Sample series: a deterministic ~90-day history, a 30-day held-out actual
    window, and per-model predictions over that same window (ensemble_weighted,
    lightgbm, sarima, arima, prophet).

    Args:
        data_status: Either "sample" or "real".
        generated_at: ISO-8601 timestamp recorded on the file.

    Returns:
        A dict matching ``schema/forecast.schema.json``.
    """
    history = [{"date": _series_date(i), "value": _series_value(i)} for i in range(_HISTORY_DAYS)]
    actual = [
        {"date": _series_date(_HISTORY_DAYS + i), "value": _series_value(_HISTORY_DAYS + i)}
        for i in range(_TEST_WINDOW_DAYS)
    ]

    models = []
    for model_id, name, offset in _FORECAST_MODELS:
        predictions = [
            {
                "date": _series_date(_HISTORY_DAYS + i),
                "value": round(_series_value(_HISTORY_DAYS + i) + offset, 2),
            }
            for i in range(_TEST_WINDOW_DAYS)
        ]
        models.append({"id": model_id, "name": name, "predictions": predictions})

    return {
        "schema_version": _SCHEMA_VERSION,
        "generated_at": generated_at,
        "data_status": data_status,
        "series": {
            "granularity": "daily_global_mean",
            "unit": "celsius",
            "train_end": history[-1]["date"],
            "test_window_days": _TEST_WINDOW_DAYS,
            "history": history,
            "actual": actual,
            "models": models,
        },
    }


# --- metrics: honesty-gated per ADR-E ----------------------------------------

_LEAKAGE_NOTE = "Withdrawn pending evaluation-leakage fix (#20)"

_FINAL_METRICS = (
    {"id": "prophet", "name": "Prophet", "rmse_c": 0.77, "mae_c": 0.69, "mape_pct": 3.95},
    {"id": "arima", "name": "ARIMA", "rmse_c": 1.71, "mae_c": 1.45, "mape_pct": 10.63},
    {"id": "sarima", "name": "SARIMA", "rmse_c": 1.13, "mae_c": 0.97, "mape_pct": 7.11},
)

_PENDING_RERUN_MODELS = (
    ("lightgbm", "LightGBM"),
    ("gradientboosting", "GradientBoosting"),
    ("ensemble_simple", "Ensemble (simple average)"),
    ("ensemble_weighted", "Ensemble (weighted)"),
)


@_sample_only
def build_metrics(
    data_status: str = "sample",
    generated_at: str = "1970-01-01T00:00:00Z",
) -> dict:
    """
    Build the ``metrics.json`` contract section.

    Per ADR-E, models affected by the evaluation-leakage retraction (#20) —
    LightGBM, GradientBoosting, and both ensemble variants — carry
    ``status: "pending_rerun"`` with every numeric field set to ``None``.
    ``ensemble_weight`` is ``None`` for every row, since the weighting itself
    derives from the leaked RMSEs. The retracted values never appear here.

    Args:
        data_status: Either "sample" or "real".
        generated_at: ISO-8601 timestamp recorded on the file.

    Returns:
        A dict matching ``schema/metrics.schema.json``.
    """
    models = [
        {
            "id": row["id"],
            "name": row["name"],
            "rmse_c": row["rmse_c"],
            "mae_c": row["mae_c"],
            "mape_pct": row["mape_pct"],
            "ensemble_weight": None,
            "status": "final",
        }
        for row in _FINAL_METRICS
    ]
    models.extend(
        {
            "id": model_id,
            "name": name,
            "rmse_c": None,
            "mae_c": None,
            "mape_pct": None,
            "ensemble_weight": None,
            "status": "pending_rerun",
            "note": _LEAKAGE_NOTE,
        }
        for model_id, name in _PENDING_RERUN_MODELS
    )

    caveats = [
        "LightGBM, GradientBoosting, and both ensemble variants were retracted due to an "
        "evaluation-leakage bug (train/test overlap); see issue #20. Their metrics and "
        "ensemble weights are withheld (status: pending_rerun) until a leakage-free "
        "re-run is published.",
    ]

    return {
        "schema_version": _SCHEMA_VERSION,
        "generated_at": generated_at,
        "data_status": data_status,
        "evaluation": {"method": "holdout", "window_days": 30},
        "models": models,
        "caveats": caveats,
    }


# --- anomalies: deterministic sample records ---------------------------------

_ANOMALY_METHODS = {
    "zscore": {"threshold": 3.0, "count": 930, "share_pct": 0.70},
    "isolation_forest": {"contamination": 0.02, "count": 2667, "share_pct": 2.00},
    "overlap_count": 219,
}

# (country, lat, lon) cycled deterministically across sample records.
_ANOMALY_LOCATIONS = (
    ("United States", 38.90, -77.03),
    ("Brazil", -15.79, -47.88),
    ("India", 28.61, 77.20),
    ("Australia", -35.28, 149.13),
    ("Egypt", 30.04, 31.24),
    ("Japan", 35.68, 139.69),
    ("Canada", 45.42, -75.70),
    ("South Africa", -25.75, 28.19),
    ("France", 48.85, 2.35),
    ("Kenya", -1.29, 36.82),
)

_ANOMALY_DETECTION_CYCLE = ("zscore", "isolation_forest", "both")

_ANOMALY_SAMPLE_COUNT = 30


@_sample_only
def build_anomalies(
    data_status: str = "sample",
    generated_at: str = "1970-01-01T00:00:00Z",
) -> dict:
    """
    Build the ``anomalies.json`` contract section.

    Sample: 30 deterministic records cycled across the 3 ``detected_by``
    values (zscore, isolation_forest, both) and 10 real-world coordinates,
    alongside the fixed method summary (930 / 2667 / 219 overlap).

    Args:
        data_status: Either "sample" or "real".
        generated_at: ISO-8601 timestamp recorded on the file.

    Returns:
        A dict matching ``schema/anomalies.schema.json``.
    """
    records = []
    for i in range(_ANOMALY_SAMPLE_COUNT):
        country, lat, lon = _ANOMALY_LOCATIONS[i % len(_ANOMALY_LOCATIONS)]
        detected_by = _ANOMALY_DETECTION_CYCLE[i % len(_ANOMALY_DETECTION_CYCLE)]
        records.append(
            {
                "ts": f"2023-{1 + i % 12:02d}-{1 + i % 28:02d}T00:00:00Z",
                "country": country,
                "lat": lat,
                "lon": lon,
                "temp_c": round(38.0 + 0.4 * i, 2),
                "z": round(3.1 + 0.05 * i, 2),
                "if_score": round(-0.55 - 0.01 * i, 2),
                "detected_by": detected_by,
            }
        )

    return {
        "schema_version": _SCHEMA_VERSION,
        "generated_at": generated_at,
        "data_status": data_status,
        "methods": copy.deepcopy(_ANOMALY_METHODS),
        "records": records,
    }


# --- shap: PM2.5 air-quality driver explanations -----------------------------

_SHAP_FEATURES = (
    ("humidity", 4.82),
    ("temperature_celsius", 3.15),
    ("wind_kph", 2.07),
    ("pressure_mb", 1.42),
)

_SHAP_POINTS_PER_FEATURE = 20


@_sample_only
def build_shap(
    data_status: str = "sample",
    generated_at: str = "1970-01-01T00:00:00Z",
) -> dict:
    """
    Build the ``shap.json`` contract section.

    Explains the PM2.5 air-quality model (never labeled "temperature SHAP").
    Sample: a handful of features (humidity, temperature_celsius, wind_kph,
    pressure_mb) each with a deterministic beeswarm point cloud.

    Args:
        data_status: Either "sample" or "real".
        generated_at: ISO-8601 timestamp recorded on the file.

    Returns:
        A dict matching ``schema/shap.schema.json``.
    """
    features = [
        {"name": name, "mean_abs_shap": mean_abs_shap} for name, mean_abs_shap in _SHAP_FEATURES
    ]

    beeswarm = []
    for feature_index, (name, _) in enumerate(_SHAP_FEATURES):
        points = []
        for i in range(_SHAP_POINTS_PER_FEATURE):
            angle = (feature_index + 1) * (i + 1)
            points.append(
                {
                    "shap": round(0.5 * math.sin(angle) * (feature_index + 1), 3),
                    "feature_value_norm": round((i / (_SHAP_POINTS_PER_FEATURE - 1)), 3),
                }
            )
        beeswarm.append({"feature": name, "points": points})

    return {
        "schema_version": _SCHEMA_VERSION,
        "generated_at": generated_at,
        "data_status": data_status,
        "model": "lightgbm",
        "target": "pm2_5",
        "sample_n": 1000,
        "features": features,
        "beeswarm": beeswarm,
    }


_SECTION_BUILDERS = {
    "meta": build_meta,
    "forecast": build_forecast,
    "metrics": build_metrics,
    "anomalies": build_anomalies,
    "shap": build_shap,
}


def validate(section: str, data: dict) -> None:
    """
    Validate ``data`` against the committed JSON Schema for ``section``.

    Args:
        section: One of "meta", "forecast", "metrics", "anomalies", "shap".
        data: The dict to validate.

    Raises:
        jsonschema.ValidationError: If ``data`` does not match the schema.
        FileNotFoundError: If no schema file exists for ``section``.
    """
    schema_path = SCHEMA_DIR / f"{section}.schema.json"
    if not schema_path.exists():
        raise FileNotFoundError(f"No schema found for section {section!r}: {schema_path}")

    schema = json.loads(schema_path.read_text())
    _jsonschema_validate(instance=data, schema=schema)


def write_contract(
    out_dir: Path,
    data_status: str = "sample",
    generated_at: str = "1970-01-01T00:00:00Z",
) -> list[Path]:
    """
    Build, validate, and write all 5 dashboard data-contract sections.

    Args:
        out_dir: Directory to write ``<section>.json`` files into (created if
            missing).
        data_status: Either "sample" or "real".
        generated_at: ISO-8601 timestamp recorded on every file.

    Returns:
        The list of written file paths, in section order (meta, forecast,
        metrics, anomalies, shap).

    Raises:
        jsonschema.ValidationError: If any built section fails schema validation.
    """
    if data_status != "sample":
        raise ValueError(
            "Only 'sample' data can be exported. The real-data reader is not "
            "implemented, so recording data_status='real' would present synthetic "
            "sample values as real model output."
        )

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    written = []
    for section, builder in _SECTION_BUILDERS.items():
        data = builder(data_status=data_status, generated_at=generated_at)
        validate(section, data)

        out_path = out_dir / f"{section}.json"
        out_path.write_text(json.dumps(data, indent=2) + "\n")
        written.append(out_path)

    return written


def _main() -> None:
    """CLI entry point: regenerate the dashboard data contract on disk."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Write the dashboard JSON data contract (schema-validated)."
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("web/public/data"),
        help="Output directory for the <section>.json files.",
    )
    parser.add_argument(
        "--data-status",
        default="sample",
        choices=["sample"],
        help="data_status recorded in each file (only 'sample' until the real-data reader lands).",
    )
    parser.add_argument(
        "--generated-at",
        default="1970-01-01T00:00:00Z",
        help="ISO-8601 timestamp recorded in each file's generated_at field.",
    )
    args = parser.parse_args()

    written = write_contract(args.out, data_status=args.data_status, generated_at=args.generated_at)
    for path in written:
        print(f"wrote {path}")


if __name__ == "__main__":
    _main()
