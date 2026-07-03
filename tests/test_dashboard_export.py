"""Unit tests for src/dashboard_export.py (dashboard JSON data contract)."""

import json
from pathlib import Path

import pytest

from src.dashboard_export import (
    build_anomalies,
    build_forecast,
    build_meta,
    build_metrics,
    build_shap,
    validate,
    write_contract,
)

_SECTIONS = ("meta", "forecast", "metrics", "anomalies", "shap")
_DATA_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data"


class TestBuildMetrics:
    """Tests for build_metrics honesty gating (ADR-E)."""

    def test_build_metrics_marks_leakage_models_pending_and_hides_019(self) -> None:
        metrics = build_metrics()

        models_by_id = {m["id"]: m for m in metrics["models"]}

        assert models_by_id["sarima"]["status"] == "final"
        assert models_by_id["lightgbm"]["status"] == "pending_rerun"
        assert models_by_id["lightgbm"]["rmse_c"] is None
        assert "0.19" not in json.dumps(metrics)

        validate("metrics", metrics)

    def test_build_metrics_hides_0_24_and_defaults_to_sample(self) -> None:
        metrics = build_metrics()

        assert "0.24" not in json.dumps(metrics)
        assert metrics["data_status"] == "sample"

    def test_build_metrics_ensemble_weight_is_null_for_every_row(self) -> None:
        metrics = build_metrics()

        assert all(m["ensemble_weight"] is None for m in metrics["models"])

    def test_build_metrics_pending_rows_note_issue_20(self) -> None:
        metrics = build_metrics()

        pending = [m for m in metrics["models"] if m["status"] == "pending_rerun"]
        assert len(pending) == 4
        assert all("#20" in m["note"] for m in pending)


class TestBuildMeta:
    """Tests for build_meta."""

    def test_build_meta_is_sample_and_schema_valid(self) -> None:
        meta = build_meta()

        assert meta["data_status"] == "sample"
        validate("meta", meta)


class TestBuildForecast:
    """Tests for build_forecast."""

    def test_build_forecast_uses_daily_global_mean_granularity(self) -> None:
        forecast = build_forecast()

        assert forecast["series"]["granularity"] == "daily_global_mean"
        assert forecast["data_status"] == "sample"
        validate("forecast", forecast)

    def test_build_forecast_has_history_actual_and_models(self) -> None:
        forecast = build_forecast()
        series = forecast["series"]

        assert len(series["history"]) == 90
        assert len(series["actual"]) == 30
        assert series["test_window_days"] == 30
        model_ids = {m["id"] for m in series["models"]}
        assert model_ids == {
            "ensemble_weighted",
            "lightgbm",
            "sarima",
            "arima",
            "prophet",
        }
        assert all(len(m["predictions"]) == 30 for m in series["models"])

    def test_build_forecast_is_deterministic(self) -> None:
        assert build_forecast() == build_forecast()


class TestBuildAnomalies:
    """Tests for build_anomalies."""

    def test_build_anomalies_matches_method_summary(self) -> None:
        anomalies = build_anomalies()

        assert anomalies["methods"]["zscore"]["count"] == 930
        assert anomalies["methods"]["isolation_forest"]["count"] == 2667
        assert anomalies["methods"]["overlap_count"] == 219
        assert anomalies["data_status"] == "sample"
        validate("anomalies", anomalies)

    def test_build_anomalies_records_span_all_detected_by_values(self) -> None:
        anomalies = build_anomalies()

        detected_by_values = {r["detected_by"] for r in anomalies["records"]}
        assert detected_by_values == {"zscore", "isolation_forest", "both"}


class TestBuildShap:
    """Tests for build_shap."""

    def test_build_shap_explains_pm25_model(self) -> None:
        shap = build_shap()

        assert shap["target"] == "pm2_5"
        assert shap["data_status"] == "sample"
        validate("shap", shap)

    def test_build_shap_beeswarm_points_capped_at_200(self) -> None:
        shap = build_shap()

        assert all(len(f["points"]) <= 200 for f in shap["beeswarm"])


class TestHonestyAcrossContract:
    """The retracted 0.19/0.24 values must never appear in any built section."""

    def test_no_retracted_values_in_any_built_section(self) -> None:
        builders = (
            build_meta,
            build_forecast,
            build_metrics,
            build_anomalies,
            build_shap,
        )
        for build in builders:
            dumped = json.dumps(build())
            assert "0.19" not in dumped
            assert "0.24" not in dumped

    def test_builders_reject_non_sample_status(self) -> None:
        # Public build_* are sample-only; they must not label synthetic output real.
        for build in (
            build_meta,
            build_forecast,
            build_metrics,
            build_anomalies,
            build_shap,
        ):
            with pytest.raises(ValueError, match="sample"):
                build(data_status="real")


class TestWriteContract:
    """Tests for write_contract."""

    def test_write_contract_emits_five_labeled_files(self, tmp_path: Path) -> None:
        written = write_contract(tmp_path)

        names = {p.name for p in written}
        assert names == {f"{section}.json" for section in _SECTIONS}

        for path in written:
            data = json.loads(path.read_text())
            assert data["data_status"] == "sample"
            validate(path.stem, data)

    def test_write_contract_refuses_non_sample_status(self, tmp_path: Path) -> None:
        # The real-data reader is not implemented, so labeling sample output "real"
        # would present synthetic values as model output. The writer must refuse.
        with pytest.raises(ValueError, match="sample"):
            write_contract(tmp_path, data_status="real")
        assert not list(tmp_path.glob("*.json"))


class TestCommittedSample:
    """The committed web/public/data/*.json sample must match its schema."""

    def test_committed_sample_matches_schema(self) -> None:
        for section in _SECTIONS:
            path = _DATA_DIR / f"{section}.json"
            data = json.loads(path.read_text())
            assert data["data_status"] == "sample"
            validate(section, data)
