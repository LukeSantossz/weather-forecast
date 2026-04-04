![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Status](https://img.shields.io/badge/status-complete-brightgreen)
![Tests](https://img.shields.io/badge/tests-37%20passed-brightgreen)

# PMA Weather Forecasting

> End-to-end weather analytics and forecasting pipeline using global climate data.

## About PM Accelerator

This project is part of the **Product Manager Accelerator Program**.

> The PM Accelerator Program is designed to support PM professionals through every stage of their career. From students looking for entry-level jobs to Directors looking to take on a leadership role, our program has helped over hundreds of students fulfill their career aspirations.

Learn more: [PM Accelerator](https://www.pmaccelerator.io/)

## 1. Project Overview

This repository contains a complete data workflow for weather analysis and short-term temperature forecasting.
The project covers data ingestion, inspection, cleaning, exploratory analysis, anomaly detection, and a baseline time-series model.

## 2. Objectives and Business Problem

The main objective is to support climate-aware decision making by:
- understanding temperature and precipitation patterns across regions;
- identifying extreme weather events (anomalies);
- producing a 30-day baseline temperature forecast.

Technical goals:
- build a reproducible data science pipeline;
- compare statistical and ML-based anomaly detection methods;
- evaluate forecast quality with RMSE, MAE, and MAPE.

## 3. Dataset and Data Source

Source dataset:
- [Global Weather Repository (Kaggle)](https://www.kaggle.com/datasets/nelgiriyewithana/global-weather-repository)

Dataset characteristics:
- ~133K rows × 41 columns
- 211 countries
- Temporal range: May 2024 → April 2026

Expected input:
- Raw file(s) downloaded manually and stored in `data/raw/`.

Key field:
- `last_updated`: timestamp used as the temporal index for time-series analysis.

## 4. Methodology (Analytical Pipeline)

1. **Data Acquisition and Inspection** (`01_dataset_inspection.ipynb`)
   - load raw dataset;
   - inspect shape, data types, null counts, and feature distribution;
   - parse `last_updated` as `datetime`.

2. **Data Cleaning and Preprocessing** (`02_preprocessing.ipynb`)
   - impute missing values (median for numerical, mode for categorical);
   - detect and handle outliers with IQR;
   - normalize numerical features;
   - encode categorical features such as country and continent.

3. **Exploratory Data Analysis** (`03_eda.ipynb`)
   - temperature trend over time by region;
   - precipitation distribution by continent;
   - climate-variable correlation heatmap;
   - monthly seasonality profile.

4. **Anomaly Detection** (`04_anomaly_detection.ipynb`)
   - Z-score baseline;
   - Isolation Forest model;
   - temporal and geographic visualization of anomalies.

5. **Forecasting Baseline** (`05_prophet_baseline.ipynb`)
   - prepare Prophet input (`ds`, `y`);
   - train with weekly and yearly seasonality;
   - generate a 30-day forecast and evaluate metrics.

6. **Advanced Forecasting** (`06_advanced_forecasting.ipynb`)
   - stationarity analysis (ADF test, ACF/PACF plots);
   - multiple models: ARIMA, SARIMA, LightGBM, GradientBoosting;
   - simple average and weighted ensemble methods;
   - model comparison vs Prophet baseline.

7. **Environmental Impact Analysis** (`07_environmental_analysis.ipynb`)
   - air quality distribution analysis;
   - weather vs air quality correlation;
   - regional air quality comparison;
   - feature importance: Random Forest, LightGBM, SHAP.

## 5. Results and Metrics

### Forecast Performance

| Model | RMSE (°C) | MAE (°C) | MAPE (%) |
|-------|-----------|----------|----------|
| Prophet (Baseline) | 0.77 | 0.69 | 3.95 |
| ARIMA(5,1,0) | - | - | - |
| SARIMA(1,1,1)(1,1,1,7) | - | - | - |
| LightGBM | - | - | - |
| GradientBoosting | - | - | - |
| Ensemble (Weighted) | - | - | - |

> Note: Model metrics (marked with `-`) are populated after running notebook 06.

### Anomaly Detection

| Method | Anomalies Detected | Share |
|--------|-------------------|-------|
| Z-score (threshold=3) | 930 | 0.70% |
| Isolation Forest (contamination=2%) | 2,667 | 2.00% |
| Both methods agree | 219 | 0.16% |

### Deliverables

- Cleaned dataset: `data/processed/cleaned_weather.parquet`
- Analysis notebooks: `notebooks/`
- Exported charts: `reports/*.png`, `reports/*.html`

## 6. Reproducibility Guide

### Prerequisites
- Python 3.10+
- pip

### Environment Setup

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
source .venv/bin/activate      # Linux/macOS
pip install -r requirements.txt
```

### Running Tests

```bash
pytest tests/ -v
```

### Running Notebooks

Execute notebooks in order (they depend on outputs from previous steps):

```bash
jupyter notebook notebooks/
```

1. `01_dataset_inspection.ipynb` — Load and profile raw data
2. `02_preprocessing.ipynb` — Clean and export to Parquet
3. `03_eda.ipynb` — Exploratory analysis and visualizations
4. `04_anomaly_detection.ipynb` — Z-score and Isolation Forest
5. `05_prophet_baseline.ipynb` — Prophet forecast and metrics
6. `06_advanced_forecasting.ipynb` — Multiple models and ensemble
7. `07_environmental_analysis.ipynb` — Air quality and feature importance

### Project Structure

```text
pma-weather-forecasting/
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
│   └── parquet_io.py         # Parquet I/O helper
├── tests/
│   ├── test_data_loader.py   # 15 tests
│   └── test_preprocessing.py # 22 tests
├── reports/                  # Exported charts (gitignored)
├── requirements.txt
└── README.md
```

### Notes
- The dataset is intentionally acquired manually from Kaggle.
- Keep `.venv` excluded from version control.
- Run notebooks sequentially; each depends on previous outputs.
