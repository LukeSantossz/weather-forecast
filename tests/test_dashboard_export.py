"""Unit tests for src/dashboard_export.py (dashboard JSON data contract)."""

import json
from pathlib import Path

import pytest

from weather_forecast.dashboard_export import (
    build_anomalies,
    build_anomalies_real,
    build_forecast,
    build_forecast_real,
    build_meta,
    build_meta_real,
    build_metrics,
    build_metrics_real,
    build_shap,
    build_shap_real,
    validate,
    write_contract,
    write_real_contract,
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

    def test_build_anomalies_methods_is_not_shared_mutable_state(self) -> None:
        first = build_anomalies()
        first["methods"]["zscore"]["count"] = 0
        second = build_anomalies()
        assert second["methods"]["zscore"]["count"] == 930


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


_GEN_AT = "2026-07-05T00:00:00Z"


class TestRealBuilders:
    """Tests for the real-data builders (#0015)."""

    def test_build_meta_real_is_real_and_schema_valid(self) -> None:
        meta = build_meta_real(generated_at=_GEN_AT, repo_commit="abc1234")

        assert meta["data_status"] == "real"
        assert meta["pipeline"]["repo_commit"] == "abc1234"
        validate("meta", meta)

    def test_build_metrics_real_marks_every_model_final(self) -> None:
        models = [
            {
                "id": "gradientboosting",
                "name": "GradientBoosting",
                "rmse_c": 0.27,
                "mae_c": 0.22,
                "mape_pct": 0.96,
                "ensemble_weight": 0.35,
            },
            {
                "id": "lightgbm",
                "name": "LightGBM",
                "rmse_c": 0.32,
                "mae_c": 0.25,
                "mape_pct": 1.06,
                "ensemble_weight": 0.41,
            },
        ]
        metrics = build_metrics_real(models, generated_at=_GEN_AT)

        assert metrics["data_status"] == "real"
        assert all(m["status"] == "final" for m in metrics["models"])
        assert not any(m["status"] == "pending_rerun" for m in metrics["models"])
        assert "pending_rerun" not in json.dumps(metrics)
        by_id = {m["id"]: m for m in metrics["models"]}
        assert by_id["gradientboosting"]["rmse_c"] == 0.27
        validate("metrics", metrics)

    def test_build_forecast_real_is_schema_valid(self) -> None:
        forecast = build_forecast_real(
            history=[{"date": "2024-05-16", "value": 23.77}],
            actual=[{"date": "2026-06-04", "value": 20.0}],
            models=[
                {
                    "id": "lightgbm",
                    "name": "LightGBM",
                    "predictions": [{"date": "2026-06-04", "value": 20.1}],
                }
            ],
            train_end="2026-06-03",
            generated_at=_GEN_AT,
        )

        assert forecast["data_status"] == "real"
        assert forecast["series"]["granularity"] == "daily_global_mean"
        validate("forecast", forecast)

    def test_build_anomalies_real_is_schema_valid(self) -> None:
        anomalies = build_anomalies_real(
            zscore={"threshold": 3.0, "count": 990, "share_pct": 0.66},
            isolation_forest={"contamination": 0.02, "count": 3021, "share_pct": 2.0},
            overlap_count=232,
            records=[
                {
                    "ts": "2026-01-01T00:00:00Z",
                    "country": "Brazil",
                    "lat": -15.8,
                    "lon": -47.9,
                    "temp_c": 41.0,
                    "z": 3.5,
                    "if_score": -0.6,
                    "detected_by": "both",
                }
            ],
            generated_at=_GEN_AT,
        )

        assert anomalies["data_status"] == "real"
        assert anomalies["methods"]["isolation_forest"]["count"] == 3021
        validate("anomalies", anomalies)

    def test_build_shap_real_caps_points_and_is_schema_valid(self) -> None:
        points = [{"shap": 0.01 * i, "feature_value_norm": 0.001 * i} for i in range(300)]
        shap = build_shap_real(
            features=[{"name": "humidity", "mean_abs_shap": 4.8}],
            beeswarm=[{"feature": "humidity", "points": points}],
            generated_at=_GEN_AT,
        )

        assert shap["data_status"] == "real"
        assert shap["target"] == "pm2_5"
        assert all(len(f["points"]) <= 200 for f in shap["beeswarm"])
        validate("shap", shap)


class TestWriteRealContract:
    """Tests for write_real_contract (#0015)."""

    def _built(self):
        return {
            "meta": build_meta_real(generated_at=_GEN_AT, repo_commit="abc1234"),
            "forecast": build_forecast_real(
                history=[{"date": "2024-05-16", "value": 23.77}],
                actual=[{"date": "2026-06-04", "value": 20.0}],
                models=[
                    {
                        "id": "lightgbm",
                        "name": "LightGBM",
                        "predictions": [{"date": "2026-06-04", "value": 20.1}],
                    }
                ],
                train_end="2026-06-03",
                generated_at=_GEN_AT,
            ),
            "metrics": build_metrics_real(
                [
                    {
                        "id": "lightgbm",
                        "name": "LightGBM",
                        "rmse_c": 0.32,
                        "mae_c": 0.25,
                        "mape_pct": 1.06,
                        "ensemble_weight": 0.41,
                    }
                ],
                generated_at=_GEN_AT,
            ),
            "anomalies": build_anomalies_real(
                zscore={"threshold": 3.0, "count": 990, "share_pct": 0.66},
                isolation_forest={"contamination": 0.02, "count": 3021, "share_pct": 2.0},
                overlap_count=232,
                records=[],
                generated_at=_GEN_AT,
            ),
            "shap": build_shap_real(
                features=[{"name": "humidity", "mean_abs_shap": 4.8}],
                beeswarm=[{"feature": "humidity", "points": []}],
                generated_at=_GEN_AT,
            ),
        }

    def test_write_real_contract_emits_five_real_files(self, tmp_path: Path) -> None:
        written = write_real_contract(tmp_path, **self._built())

        names = {p.name for p in written}
        assert names == {f"{section}.json" for section in _SECTIONS}
        for path in written:
            data = json.loads(path.read_text())
            assert data["data_status"] == "real"
            validate(path.stem, data)

    def test_write_real_contract_refuses_non_real_section(self, tmp_path: Path) -> None:
        sections = self._built()
        sections["metrics"] = build_metrics()  # a sample section
        with pytest.raises(ValueError, match="real"):
            write_real_contract(tmp_path, **sections)


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


class TestCommittedContract:
    """The committed web/public/data/*.json is the real, schema-valid contract (#0015)."""

    def test_committed_contract_is_real_and_schema_valid(self) -> None:
        for section in _SECTIONS:
            path = _DATA_DIR / f"{section}.json"
            data = json.loads(path.read_text())
            assert data["data_status"] == "real"
            validate(section, data)

    def test_committed_metrics_has_no_pending_rerun(self) -> None:
        data = json.loads((_DATA_DIR / "metrics.json").read_text())
        assert all(m["status"] == "final" for m in data["models"])
        assert "pending_rerun" not in json.dumps(data)
