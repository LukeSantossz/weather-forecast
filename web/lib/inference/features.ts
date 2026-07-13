// Feature preparation for browser-side anomaly inference: median fill then StandardScaler,
// reproducing src/weather_forecast/anomaly.py exactly so JS and Python agree to 1e-6.

export interface AnomalyModelLike {
  medians: number[];
  scaler: { mean: number[]; scale: number[] };
}

/**
 * Standardize a raw feature vector the way the fitted pipeline does: a non-finite (missing)
 * value is replaced by that feature's median, then (x - mean) / scale is applied per feature.
 */
export function standardize(raw: number[], model: AnomalyModelLike): number[] {
  const { medians } = model;
  const { mean, scale } = model.scaler;
  return raw.map((x, i) => {
    const filled = Number.isFinite(x) ? x : medians[i];
    return (filled - mean[i]) / scale[i];
  });
}
