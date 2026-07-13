// Population z-score anomaly verdict on a single value, reproducing
// src/weather_forecast/anomaly.py::zscore_anomalies (mu/sigma are the exported population
// baseline; a missing value falls back to mu, giving z 0).

export interface ZParams {
  mu: number;
  sigma: number;
  threshold: number;
}

export function zscore(temp: number, z: ZParams): { z: number; isAnomaly: boolean } {
  const value = Number.isFinite(temp) ? temp : z.mu;
  const zv = (value - z.mu) / z.sigma;
  return { z: zv, isAnomaly: Math.abs(zv) > z.threshold };
}
