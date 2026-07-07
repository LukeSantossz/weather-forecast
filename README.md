![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![CI](https://github.com/LukeSantossz/weather-forecast/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-164%20passed-brightgreen)
![Status](https://img.shields.io/badge/status-complete-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

# Global Temperature Forecasting Pipeline

> Forecasting a global daily-mean temperature signal built from 211 countries' data, using statistical and machine-learning ensemble methods, for agricultural, energy, and public-safety planning.

---

## What It Does

A data-science pipeline that forecasts a global daily-mean temperature series and flags anomalous weather events from raw global weather data.

- **Temperature forecasting** — a global daily-mean temperature series from a weighted ensemble of statistical and machine-learning models (built from 211 countries' data, not per-country forecasts)
- **Anomaly detection** — flags extreme weather with Z-score and Isolation Forest, plus overlap analysis between methods
- **Reproducible preprocessing** — cleans 151,000+ raw observations into type-safe, compressed Parquet
- **Environmental analysis** — an air-quality (PM2.5) study with SHAP feature-importance attribution, separate from the temperature forecaster

## What It Is

Global Temperature Forecasting Pipeline is an **installable Python package** (`weather_forecast`) with a tested `src/` pipeline, a training CLI, a FastAPI serving service, MLflow/Evidently observability, and a Next.js dashboard — with the original Jupyter notebooks kept as a narrative that now calls into the package. It turns raw weather CSVs into temperature forecasts and anomaly reports for teams whose planning depends on short-term weather: agriculture (frost/heat alerts, irrigation scheduling), energy (demand prediction, grid balancing), and public safety (extreme-weather warnings).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Language | Python 3.10+ |
| Data processing | pandas, NumPy, PyArrow (Parquet) |
| Forecasting | LightGBM, scikit-learn (GradientBoosting), statsmodels (ARIMA/SARIMA), Prophet |
| Anomaly detection | scikit-learn (Isolation Forest), SciPy / NumPy (Z-score) |
| Serving | FastAPI, Uvicorn, Docker (multi-stage) |
| MLOps | MLflow (tracking), Evidently (drift) |
| Semantic search | sentence-transformers (`all-MiniLM-L6-v2`) |
| Dashboard | Next.js (static export), Astryx design system, D3, MapLibre |
| Packaging / CI | hatchling, pytest, ruff, mypy, GitHub Actions |

## Architecture

```mermaid
flowchart LR
    A[Raw CSV\n151K rows x 41 cols]

    subgraph Preprocessing utilities
        A --> B[data_loader]
        B --> C[preprocessing\nIQR clipping + imputation]
        C -. optional export .-> D[Parquet\ntype-safe + compressed]
    end

    subgraph Forecasting Pipeline
        A --> E[Daily-mean aggregation]
        E --> F[ARIMA]
        E --> G[SARIMA]
        E --> H[LightGBM]
        E --> I[GradientBoosting]
        F & G & H & I --> J[Inverse-RMSE\nWeighted Ensemble]
        J --> K[Evaluation\nRMSE / MAE / MAPE]
    end

    subgraph Anomaly Detection
        A --> L[Z-score\nthreshold=3]
        A --> M[Isolation Forest\ncontamination=2%]
        L & M --> N[Overlap analysis\n232 agreed anomalies]
    end

    subgraph Serving and Products
        K --> P[Persisted artifact\nweather_forecast.persistence]
        P --> Q[FastAPI service\n/forecast /anomaly /health]
        K --> R[MLflow tracking\nEvidently drift]
        N --> S[Dashboard JSON contract\nweb/public/data]
        S --> T[Next.js dashboard\nforecast / anomalies / search]
    end
```

The whole pipeline lives in the installable `weather_forecast` package and runs from a training CLI (`python -m weather_forecast.train`); the notebooks are a narrative that calls into it. Preprocessing can export a cleaned, compressed Parquet, but that is optional: the forecasting and anomaly-detection paths read the raw CSV directly (architecture decision EVO-1(b)). Forecasting fans out into four models that feed an inverse-RMSE weighted ensemble; anomaly detection runs two independent methods and reports their overlap. Trained artifacts are persisted, served over a FastAPI API, tracked with MLflow, monitored for drift with Evidently, and surfaced (with honest provenance) in a static Next.js dashboard.

## Engineering Decisions

The significant, hard-to-reverse decisions, each recorded as an ADR under
[`docs/adr/`](docs/adr/) (see [ADR 0001](docs/adr/0001-decision-records-flow.md) for the flow):

| Decision | ADR |
|----------|-----|
| IQR clipping for outliers (preserves temporal continuity) | [0005](docs/adr/0005-iqr-outlier-clipping.md) |
| Parquet for the processed store (type safety, compression) | [0006](docs/adr/0006-parquet-processed-store.md) |
| Column-candidates loader (handles dataset-version drift) | [0007](docs/adr/0007-column-candidates-loader.md) |
| PyArrow engine directly (avoids a Jupyter kernel crash) | [0008](docs/adr/0008-pyarrow-engine-direct.md) |
| Lag + rolling features (captures autoregressive structure) | [0009](docs/adr/0009-lag-rolling-features.md) |
| Inverse-RMSE weighted ensemble (risk diversification) | [0010](docs/adr/0010-inverse-rmse-ensemble.md) |
| Observatory identity, single-scroll IA, self-hosted fonts | [0002](docs/adr/0002-observatory-identity.md), [0003](docs/adr/0003-single-scroll-narrative.md), [0004](docs/adr/0004-nextfont-typography.md) |

## Results

### Forecast Performance

| Model | RMSE (°C) | MAE (°C) | MAPE (%) |
|-------|-----------|----------|----------|
| GradientBoosting | 0.27 | 0.22 | 0.96 |
| LightGBM | 0.32 | 0.25 | 1.06 |
| Ensemble (Weighted) | 0.35 | 0.28 | 1.22 |
| Ensemble (Simple Avg) | 0.47 | 0.38 | 1.61 |
| ARIMA(5,1,0) | 0.73 | 0.57 | 2.43 |
| Prophet (Baseline) | 0.77 | 0.69 | 3.95 |
| SARIMA(1,1,1)(1,1,1,7) | 0.80 | 0.61 | 2.62 |

All rows come from a single leakage-free evaluation on the current dataset (2024-05-16 to 2026-07-03): the final 30 days are held out as the test window and scored exactly once. Both LightGBM's early stopping and the weighted ensemble's inverse-RMSE weights are fit on a validation slice carved from the training window, never on the test set (issue [#20](https://github.com/LukeSantossz/weather-forecast/issues/20)). GradientBoosting is the strongest single model at 0.27 °C RMSE, with LightGBM close behind at 0.32; both clearly beat the classical baselines (ARIMA 0.73, Prophet 0.77, SARIMA 0.80). The inverse-RMSE weighted ensemble (0.35) lands between them: it underperforms the best single model because ARIMA and SARIMA still carry about 24% of the weight and pull its predictions off. The earlier headline figure, produced under evaluation leakage, was withdrawn under #20; these numbers replace it.

### Anomaly Detection

| Method | Anomalies Detected | Share |
|--------|-------------------|-------|
| Z-score (threshold=3) | 990 | 0.66% |
| Isolation Forest (contamination=2%) | 3,021 | 2.00% |
| Both methods agree | 232 | 0.15% |

## Getting Started

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
git clone https://github.com/LukeSantossz/weather-forecast.git
cd weather-forecast
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Running

Run the whole forecast pipeline from the CLI and print per-model metrics (add `--save` to persist a forecaster, `--track` to log an MLflow run):

```bash
python -m weather_forecast.train --project-root .
```

Or open the notebooks — a narrative that now calls into the `weather_forecast` package. Each reads the raw CSV directly, so they run independently; the numbering is only a suggested reading order, and notebook 02's Parquet export is optional (EVO-1(b)):

```bash
jupyter notebook notebooks/
```

| # | Notebook | Purpose |
|---|----------|---------|
| 1 | `01_dataset_inspection.ipynb` | Load and profile raw data |
| 2 | `02_preprocessing.ipynb` | Clean, handle outliers, export to Parquet |
| 3 | `03_eda.ipynb` | Exploratory analysis and visualizations |
| 4 | `04_anomaly_detection.ipynb` | Z-score and Isolation Forest |
| 5 | `05_prophet_baseline.ipynb` | Prophet forecast baseline |
| 6 | `06_advanced_forecasting.ipynb` | ARIMA, SARIMA, LightGBM, ensemble |
| 7 | `07_environmental_analysis.ipynb` | Air quality and SHAP feature importance |

### Tests

```bash
pytest tests/ -v
```

### API

A FastAPI service serves the trained pipeline over HTTP ([#16](https://github.com/LukeSantossz/weather-forecast/issues/16)). Install the serving extra and run it locally:

```bash
pip install -e ".[serving]"
uvicorn weather_forecast.api.app:app --reload
```

Or with Docker:

```bash
docker compose up --build
```

The service loads a persisted forecaster from the directory named by `MODELS_DIR` (default `models/`). Create one with the training CLI:

```bash
python -m weather_forecast.train --save
```

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness probe; reports whether a forecaster is loaded |
| POST | `/anomaly` | Score a batch (min 10 observations) with the Z-score and Isolation Forest detectors |
| POST | `/forecast` | Forecast N steps from the persisted forecaster (`503` if none is loaded) |

`/forecast` serves the ARIMA model that `train --save` persists (the simplest first forecaster to serve). Serving the stronger ML models — GradientBoosting/LightGBM, which need inference-time feature engineering — is planned as a follow-up. `/anomaly` scores a batch **relative to itself** (the detectors fit on the submitted rows), so it needs a real batch, not a single reading, and returns HTTP 422 below the minimum.

Interactive OpenAPI docs are served at `/docs`. Example requests:

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/forecast \
  -H "Content-Type: application/json" \
  -d '{"horizon": 7}'

# /anomaly needs a batch of at least 10 observations; build one and post it:
python - <<'PY' | curl -X POST http://localhost:8000/anomaly \
  -H "Content-Type: application/json" -d @-
import json
rows = [{"temperature_celsius": 20.0 + i, "humidity": 50, "wind_kph": 10,
         "pressure_mb": 1012, "precip_mm": 0} for i in range(12)]
rows[-1]["temperature_celsius"] = 60.0  # an outlier within the batch
print(json.dumps({"observations": rows}))
PY
```

### Experiment tracking and drift monitoring

MLflow tracking and Evidently drift reporting live in the `mlops` extra ([#17](https://github.com/LukeSantossz/weather-forecast/issues/17)):

```bash
pip install -e ".[mlops]"
```

Log a training run's params, per-model metrics, and the saved artifact to a local MLflow file store (`mlruns/`):

```bash
python -m weather_forecast.train --save --track
mlflow ui   # then open http://localhost:5000 (requires the full `mlflow` package)
```

Report data drift between an earlier reference window and the most recent window of the daily series, optionally writing an HTML report:

```bash
python -m weather_forecast.drift --window-days 30 --html reports/drift.html
```

The command prints a JSON summary (`dataset_drift`, `drifted_columns`, `share`, and per-column K-S p-values); a column is flagged when its p-value falls below 0.05, and the dataset is flagged when at least half of the checked columns drift.

### Semantic search

Search the detected anomalies in natural language ([#32](https://github.com/LukeSantossz/weather-forecast/issues/32)). The core is keyless and offline: sentence-transformer embeddings (`all-MiniLM-L6-v2`) with an in-memory cosine search, no external service.

```bash
pip install -e ".[nlp]"
python -m weather_forecast.semantic_search --query "extreme heat events" --top-k 5
```

Precompute the embeddings shipped to the dashboard data contract (`web/public/data/anomaly_embeddings.json`):

```bash
python -m weather_forecast.semantic_search --build-embeddings web/public/data/anomaly_embeddings.json
```

The dashboard's Anomalies tab exposes this as a browser-side demo: selecting one of the precomputed example queries ranks the anomaly records by cosine similarity entirely in the browser, with no model and no network beyond the static JSON.

### Dashboard

A Next.js (static-export) dashboard in `web/` presents the results with Meta's Astryx design system: a **Forecast** tab (history + holdout with per-model toggles and the metrics table), an **Anomalies** tab (a MapLibre map, a records list, and the semantic-search demo), and a **Drivers** tab (SHAP attribution). It reads the JSON data contract in `web/public/data/` (validated by JSON schemas in `web/public/data/schema/`).

```bash
cd web
npm install
npm run build && npx serve out   # or: npm run dev
```

Provenance is a first-class UI concern: a banner renders `[ REAL ] generated <date> · commit <sha>` or `[ SAMPLE DATA ]` from the data's `data_status`, metric rows can show a "pending re-run" state instead of a number the project no longer stands behind, and the export code refuses to label synthetic data as real. Regenerate the real data contract from the notebooks (or `dashboard_export`) so the banner reflects the current commit.

## Project Structure

```text
weather-forecast/
├── src/weather_forecast/      # Installable package (hatchling)
│   ├── data_loader.py         # Raw CSV loading + column validation
│   ├── preprocessing.py       # IQR clipping, imputation, one-hot
│   ├── parquet_io.py          # Type-safe Parquet I/O
│   ├── features.py            # Lag / rolling / calendar features (leakage-safe)
│   ├── models.py              # ARIMA, SARIMA, LightGBM, GB, ensembling
│   ├── anomaly.py             # Z-score + Isolation Forest detectors
│   ├── evaluation.py          # RMSE / MAE / MAPE
│   ├── config.py              # Frozen config + global seed
│   ├── logging_setup.py       # Structured logging
│   ├── train.py               # End-to-end forecast + training CLI
│   ├── persistence.py         # Versioned model artifacts + metadata
│   ├── conformal.py           # Split-conformal prediction intervals
│   ├── dashboard_export.py    # Dashboard JSON data-contract export
│   ├── tracking.py            # MLflow experiment tracking
│   ├── drift.py               # Evidently data-drift reporting
│   ├── semantic_search.py     # sentence-transformer anomaly search
│   └── api/                   # FastAPI app + Pydantic schemas
├── tests/                     # 164 unit tests (pytest)
├── notebooks/                 # 01-07 narrative, calling into the package
├── web/                       # Next.js dashboard (static export, Astryx)
│   └── public/data/           # JSON data contract + JSON schemas
├── docs/specs/                # Numbered SPECs (spec-first workflow)
├── .github/workflows/ci.yml   # test matrix, lint, docker-build, nlp-test
├── Dockerfile, docker-compose.yml
├── pyproject.toml             # core deps + dev/serving/mlops/nlp/notebooks extras
├── data/ (gitignored), reports/ (gitignored), models/ (gitignored)
└── README.md
```

## Project Status

**Status: complete**

### Done

- [x] Pipeline extracted into an installable, tested `src/weather_forecast` package with a training CLI (#14)
- [x] Preprocessing pipeline — IQR clipping, imputation, type-safe Parquet export
- [x] Five forecasting approaches plus weighted ensemble, all scored under a leakage-free evaluation (#20)
- [x] Anomaly detection — Z-score and Isolation Forest with overlap analysis
- [x] Environmental analysis with SHAP feature-importance for a PM2.5 air-quality model
- [x] Versioned model persistence with dependency/metric lineage (#15)
- [x] FastAPI serving layer (`/health`, `/anomaly`, `/forecast`) with a Docker image (#16)
- [x] MLflow experiment tracking and Evidently drift monitoring (#17)
- [x] Semantic search over anomalies, with a browser-side dashboard demo (#32)
- [x] Next.js dashboard with honest sample/real provenance
- [x] 164 unit tests with GitHub Actions CI (test matrix, lint, docker-build, nlp-test)

### Pending

- [ ] Validation on data beyond the current 2-year window (rolling-origin backtesting)
- [ ] Serving the stronger ML forecaster (feature-based) instead of ARIMA
- [ ] Free-text (in-browser) query embedding for the dashboard search

## Known Issues & Limitations

- **Datasets are not bundled** — raw and processed data are gitignored; reproducing the results requires the source Kaggle CSV placed under `data/raw/`.
- **Temporal and geographic scope** — the model forecasts a global daily-mean series built from roughly 2 years of data across 211 countries; it is not a per-country forecast, and accuracy on longer horizons or unseen climate regimes is unverified.
- **Evaluation leakage (resolved, [#20](https://github.com/LukeSantossz/weather-forecast/issues/20))** — an earlier version passed the held-out test set to LightGBM as its early-stopping validation set and then scored it, deflating the reported RMSE. The fix carves the early-stopping validation slice from the training window and scores the test window exactly once; the results table now reflects the corrected, leakage-free metrics on the current dataset. The inflated headline figure it once produced is not reproduced anywhere.
- **Single-holdout evaluation** — model comparisons rest on one 30-day holdout scored once, so the ranking and the 0.27 °C headline carry unquantified variance; rolling-origin backtesting is pending.
- **Batch-relative anomaly API** — `POST /anomaly` scores each request batch against itself rather than a persisted reference distribution, so it needs a real batch (min 10) and is best for finding outliers *within* a submission.
- **ARIMA-only serving** — `/forecast` serves the persisted ARIMA model (0.73 °C RMSE), not the stronger GradientBoosting/LightGBM (0.27-0.32), which need inference-time feature engineering.

## Contributing

Contributions follow the development standards in the [`.standards`](.standards) submodule (spec at the Gate, test-first, Conventional Commits, R1/R2/R3 review). See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and setup.

## License

Released under the [MIT License](LICENSE).
