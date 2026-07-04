![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![CI](https://github.com/LukeSantossz/weather-forecast/actions/workflows/ci.yml/badge.svg)
![Tests](https://img.shields.io/badge/tests-70%20passed-brightgreen)
![Status](https://img.shields.io/badge/status-complete-brightgreen)

# Global Temperature Forecasting Pipeline

> Forecasting a global daily-mean temperature signal built from 211 countries' data, using statistical and machine-learning ensemble methods, for agricultural, energy, and public-safety planning.

---

## What It Does

A data-science pipeline that forecasts a global daily-mean temperature series and flags anomalous weather events from raw global weather data.

- **Temperature forecasting** — a global daily-mean temperature series from a weighted ensemble of statistical and machine-learning models (built from 211 countries' data, not per-country forecasts)
- **Anomaly detection** — flags extreme weather with Z-score and Isolation Forest, plus overlap analysis between methods
- **Reproducible preprocessing** — cleans 133,000+ raw observations into type-safe, compressed Parquet
- **Environmental analysis** — an air-quality (PM2.5) study with SHAP feature-importance attribution, separate from the temperature forecaster

## What It Is

Global Temperature Forecasting Pipeline is a **research codebase** — sequential Jupyter notebooks backed by a tested `src/` utility package — that turns raw weather CSVs into temperature forecasts and anomaly reports. It targets teams whose planning depends on short-term weather: agriculture (frost/heat alerts, irrigation scheduling), energy (demand prediction, grid balancing), and public safety (extreme-weather warnings).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Language | Python 3.10+ |
| Data processing | pandas, NumPy, PyArrow (Parquet) |
| Forecasting | LightGBM, scikit-learn (GradientBoosting), statsmodels (ARIMA/SARIMA), Prophet |
| Anomaly detection | scikit-learn (Isolation Forest), SciPy / NumPy (Z-score) |
| Testing / CI | pytest, GitHub Actions |

## Architecture

```mermaid
flowchart LR
    A[Raw CSV\n133K rows x 41 cols]

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
        L & M --> N[Overlap analysis\n219 agreed anomalies]
    end
```

The preprocessing utilities can export a cleaned, compressed Parquet, but that file is an optional export: the forecasting and anomaly-detection notebooks read the raw CSV directly (architecture decision EVO-1(b)). Forecasting fans out into four models that feed an inverse-RMSE weighted ensemble, while anomaly detection runs two independent methods and reports their overlap rather than either result alone.

## Engineering Decisions

| Decision | Alternative considered | Why this approach |
|----------|----------------------|-------------------|
| IQR clipping for outliers | Z-score removal | Preserves temporal continuity; Z-score drops entire rows, breaking time-series |
| Parquet for processed data | CSV | Type safety, 3-5x compression, schema enforcement via PyArrow |
| Column candidates pattern in data_loader | Hardcoded column names | Handles schema variation across Kaggle dataset versions gracefully |
| PyArrow engine directly | pandas `to_parquet` wrapper | Avoids known Jupyter kernel crash with pandas PyArrow backend |
| Lag + rolling features (1-21 days) | Raw values only | Captures autoregressive structure for the ML models; the size of the gain is pending a leakage-free re-run (#20) |
| Inverse-RMSE weighted ensemble | Simple average / single best model | Risk diversification; weights reflect demonstrated model accuracy |

## Results

### Forecast Performance

| Model | RMSE (°C) | MAE (°C) | MAPE (%) |
|-------|-----------|----------|----------|
| Prophet (Baseline) | 0.77 | 0.69 | 3.95 |
| ARIMA(5,1,0) | 1.71 | 1.45 | 10.63 |
| SARIMA(1,1,1)(1,1,1,7) | 1.13 | 0.97 | 7.11 |
| LightGBM | withdrawn | withdrawn | withdrawn |
| GradientBoosting | withdrawn | withdrawn | withdrawn |
| Ensemble (Simple Avg) | withdrawn | withdrawn | withdrawn |
| Ensemble (Weighted) | withdrawn | withdrawn | withdrawn |

The LightGBM, GradientBoosting, and both ensemble rows are withdrawn: their previously reported scores were produced under evaluation leakage and are not trustworthy. A leakage-free re-run is tracked in issue [#20](https://github.com/LukeSantossz/weather-forecast/issues/20); see Known Issues below. Among the statistically validated models, Prophet is the strongest at 0.77 °C RMSE, ahead of SARIMA (1.13) and ARIMA (1.71).

### Anomaly Detection

| Method | Anomalies Detected | Share |
|--------|-------------------|-------|
| Z-score (threshold=3) | 930 | 0.70% |
| Isolation Forest (contamination=2%) | 2,667 | 2.00% |
| Both methods agree | 219 | 0.16% |

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

Execute the notebooks in order — each depends on outputs from previous steps:

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

## Project Structure

```text
weather-forecast/
├── data/
│   ├── raw/                  # Raw CSV (gitignored)
│   └── processed/            # Cleaned Parquet (gitignored)
├── notebooks/
│   ├── 01_dataset_inspection.ipynb
│   ├── 02_preprocessing.ipynb
│   ├── 03_eda.ipynb
│   ├── 04_anomaly_detection.ipynb
│   ├── 05_prophet_baseline.ipynb
│   ├── 06_advanced_forecasting.ipynb
│   └── 07_environmental_analysis.ipynb
├── src/
│   ├── __init__.py           # Package exports
│   ├── data_loader.py        # Data loading utilities
│   ├── preprocessing.py      # Cleaning pipeline
│   ├── parquet_io.py         # Parquet I/O helper
│   └── dashboard_export.py   # Dashboard JSON data-contract export
├── tests/
│   ├── test_data_loader.py      # 20 tests
│   ├── test_preprocessing.py    # 27 tests
│   ├── test_parquet_io.py       # 5 tests
│   └── test_dashboard_export.py # 18 tests
├── reports/                  # Exported charts (gitignored)
├── requirements.txt
└── README.md
```

## Project Status

**Status: complete**

### Done

- [x] Preprocessing pipeline — IQR clipping, imputation, type-safe Parquet export
- [x] Five forecasting approaches plus weighted ensemble (gradient-boosted and ensemble scores withdrawn pending a leakage-free re-run, #20)
- [x] Anomaly detection — Z-score and Isolation Forest with overlap analysis
- [x] Environmental analysis with SHAP feature-importance for a PM2.5 air-quality model
- [x] 70 passing unit tests with GitHub Actions CI

### Pending

- [ ] Serving layer for scheduled or on-demand inference
- [ ] Validation on data beyond the current 2-year window

## Known Issues & Limitations

- **Datasets are not bundled** — raw and processed data are gitignored; reproducing the results requires the source Kaggle CSV placed under `data/raw/`.
- **Temporal and geographic scope** — the model forecasts a global daily-mean series built from roughly 2 years of data across 211 countries; it is not a per-country forecast, and accuracy on longer horizons or unseen climate regimes is unverified.
- **Evaluation leakage in the gradient-boosted and ensemble scores (retracted)** — the previously reported LightGBM, GradientBoosting, and ensemble metrics, including the headline figure once quoted in this README, were produced under evaluation leakage and have been withdrawn. Only the Prophet, ARIMA, and SARIMA rows remain in the results table. A leakage-free re-run is tracked in [#20](https://github.com/LukeSantossz/weather-forecast/issues/20).
- **No serving layer** — the pipeline runs as notebooks; there is no API or scheduled-inference component yet.
- **Test coverage is partial** — automated tests cover `data_loader` and `preprocessing`; forecasting and anomaly logic live in notebooks and are validated manually.
