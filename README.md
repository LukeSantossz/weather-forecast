![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Status](https://img.shields.io/badge/status-in%20development-yellow)

# PMA Weather Forecasting

> End-to-end weather analytics and forecasting pipeline using global climate data.

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
- [Global Weather Repository (Kaggle)](https://www.kaggle.com/datasets/nelgiriyewithana/global-weather-repository/code)

Expected input:
- raw file(s) downloaded manually and stored in `data/raw/`.

Key field:
- `last_updated`: timestamp used as the temporal index for time-series analysis.

## 4. Methodology (Analytical Pipeline)

1. **Data Acquisition and Inspection**
   - load raw dataset;
   - inspect shape, data types, null counts, and feature distribution;
   - parse `last_updated` as `datetime`.

2. **Data Cleaning and Preprocessing**
   - impute missing values (median for numerical, mode for categorical);
   - detect and handle outliers with IQR;
   - normalize numerical features;
   - encode categorical features such as country and continent.

3. **Exploratory Data Analysis (EDA)**
   - temperature trend over time by region;
   - precipitation distribution by continent;
   - climate-variable correlation heatmap;
   - monthly seasonality profile.

4. **Anomaly Detection**
   - Z-score baseline;
   - Isolation Forest model;
   - temporal and geographic visualization of anomalies.

5. **Forecasting Baseline**
   - prepare Prophet input (`ds`, `y`);
   - train with weekly and yearly seasonality;
   - generate a 30-day forecast and evaluate metrics.

## 5. Results and Metrics

Deliverables generated during implementation:
- cleaned dataset: `data/cleaned_weather.parquet`;
- analysis notebooks in `notebooks/`;
- exported charts and reports in `reports/`.

Primary metrics:
- RMSE
- MAE
- MAPE

This section will be updated with experimental results as tasks are completed.

## 6. Reproducibility Guide

### Prerequisites
- Python 3.10+
- pip

### Environment Setup

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Project Structure

```text
pma-weather-forecasting/
├── data/
│   ├── raw/
│   └── processed/
├── notebooks/
├── src/
├── reports/
├── requirements.txt
└── README.md
```

### Notes
- The dataset is intentionally acquired manually from Kaggle.
- Keep `.venv` excluded from version control.
