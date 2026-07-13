'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { loadAnomalyModel } from '../../lib/contract';
import type { AnomalyModel } from '../../lib/contract';
import { standardize } from '../../lib/inference/features';
import { scoreSamples, isAnomalyFromScore } from '../../lib/inference/isolationForest';
import { zscore } from '../../lib/inference/zscore';
import type { AnomalyMapHandle, SyntheticMethod } from './AnomalyMap';

type LoadStatus = 'loading' | 'error' | 'ready';

// The five Isolation Forest features, in the exact order the model expects
// (src/weather_forecast/anomaly.py DEFAULT_IF_FEATURES). Labels/units are
// presentation only; the slider domains come from the model's feature_ranges.
const FEATURES: { label: string; unit: string; decimals: number }[] = [
  { label: 'Temperature', unit: '°C', decimals: 1 },
  { label: 'Humidity', unit: '%', decimals: 0 },
  { label: 'Wind', unit: 'kph', decimals: 1 },
  { label: 'Pressure', unit: 'mb', decimals: 1 },
  { label: 'Precipitation', unit: 'mm', decimals: 1 },
];

function midpoints(model: AnomalyModel): number[] {
  return model.feature_ranges.min.map((lo, i) => (lo + model.feature_ranges.max[i]) / 2);
}

function fmt(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

export interface AnomalyCheckerProps {
  /** The Anomalies act's shared AnomalyMap ref (AnomaliesSection owns it): the
   * checker drops its synthetic observation on the real map. `null` until the
   * map has mounted (gated on visibility), in which case the calls are no-ops. */
  mapRef: RefObject<AnomalyMapHandle | null>;
  /** The latest empty-map click, or null. A fresh object per click (its `seq`
   * changes) so re-clicking the same spot still re-places the point. */
  mapClick: { lat: number; lon: number; seq: number } | null;
}

// DESIGN: a live, browser-side anomaly checker (spec 0033). Five sliders drive
// both project methods - the temperature z-score and the five-feature Isolation
// Forest - computed entirely in the browser from the exported anomaly_model.json
// (loaded once here; every slider move is pure computation, no network). It
// turns the read-only Anomalies act into something the visitor operates.
export default function AnomalyChecker({ mapRef, mapClick }: AnomalyCheckerProps) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [model, setModel] = useState<AnomalyModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [values, setValues] = useState<number[]>([]);
  const [placed, setPlaced] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAnomalyModel()
      .then((result) => {
        if (cancelled) return;
        setModel(result);
        setValues(midpoints(result));
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Both verdicts, recomputed in the browser on every slider change. Guarded so
  // it only runs once the model and the value vector are both ready.
  const verdict = useMemo(() => {
    if (!model || values.length !== FEATURES.length) return null;
    const scaled = standardize(values, model);
    const z = zscore(values[0], model.zscore);
    // One forest traversal per change: derive the verdict from the score, not a second pass.
    const ifScore = scoreSamples(scaled, model.isolation_forest);
    const ifAnomaly = isAnomalyFromScore(ifScore, model.isolation_forest);
    return { z, ifScore, ifAnomaly, both: z.isAnomaly && ifAnomaly };
  }, [model, values]);

  // A new empty-map click parks the synthetic point at that location.
  useEffect(() => {
    if (!mapClick) return;
    setPlaced({ lat: mapClick.lat, lon: mapClick.lon });
  }, [mapClick]);

  // While a point is placed, keep it in sync with the sliders: its colour
  // tracks the temperature and its shape tracks the flagging method. Location is
  // context only and never enters the model, so it is not part of the verdict.
  useEffect(() => {
    if (!placed || !verdict) return;
    const method: SyntheticMethod = verdict.both
      ? 'both'
      : verdict.z.isAnomaly
        ? 'zscore'
        : verdict.ifAnomaly
          ? 'isolation_forest'
          : 'none';
    mapRef.current?.placeSyntheticPoint(placed.lat, placed.lon, values[0], method);
  }, [placed, verdict, values, mapRef]);

  if (status === 'loading') {
    return (
      <div className="anomaly-checker">
        <Skeleton width="100%" height={220} radius={0} />
      </div>
    );
  }

  if (status === 'error' || !model || !verdict) {
    return (
      <div className="anomaly-checker">
        <Text as="p" type="supporting" color="secondary">
          The live checker is unavailable: {error?.message}
        </Text>
      </div>
    );
  }

  const setValue = (index: number, next: number) =>
    setValues((prev) => prev.map((v, i) => (i === index ? next : v)));

  const clearPlaced = () => {
    setPlaced(null);
    mapRef.current?.clearSyntheticPoint();
  };

  const zVerdict = verdict.z.isAnomaly ? 'Anomaly' : 'Normal';
  const ifVerdict = verdict.ifAnomaly ? 'Anomaly' : 'Normal';
  const overlap = verdict.both
    ? 'Both methods flag this reading'
    : verdict.z.isAnomaly || verdict.ifAnomaly
      ? 'One method flags this reading'
      : 'Neither method flags this reading';

  return (
    <div className="anomaly-checker">
      <div className="anomaly-checker-header">
        <Text as="h3" type="large" weight="semibold" color="primary">
          Would this reading be flagged?
        </Text>
        <span className="anomaly-checker-sub">
          both methods, computed in-browser from the exported model
        </span>
      </div>

      <p className="anomaly-checker-hint">
        Dial a hypothetical observation. The page runs the temperature z-score and the
        five-feature Isolation Forest live, with no server call after the model loads.
      </p>

      <div className="anomaly-checker-body">
        <div className="anomaly-checker-sliders">
          {FEATURES.map((f, i) => {
            const lo = model.feature_ranges.min[i];
            const hi = model.feature_ranges.max[i];
            const id = `anomaly-checker-${i}`;
            return (
              <div className="anomaly-checker-slider" key={f.label}>
                <label htmlFor={id} className="anomaly-checker-slider-label">
                  <span>{f.label}</span>
                  <span className="anomaly-checker-slider-value">
                    {fmt(values[i], f.decimals)} {f.unit}
                  </span>
                </label>
                <input
                  id={id}
                  type="range"
                  min={lo}
                  max={hi}
                  step={f.decimals === 0 ? 1 : 0.1}
                  value={values[i]}
                  aria-valuetext={`${fmt(values[i], f.decimals)} ${f.unit}`}
                  onChange={(e) => setValue(i, Number(e.target.value))}
                />
              </div>
            );
          })}
        </div>

        <div className="anomaly-checker-readouts" aria-hidden="true">
          <div
            className={`anomaly-checker-card${verdict.z.isAnomaly ? ' is-anomaly' : ''}`}
          >
            <span className="anomaly-checker-card-label">Z-score (temperature)</span>
            <span className="anomaly-checker-card-value">z = {verdict.z.z.toFixed(2)}</span>
            <span className="anomaly-checker-verdict">{zVerdict}</span>
            <span className="anomaly-checker-card-note">
              flags when |z| &gt; {model.zscore.threshold}
            </span>
          </div>

          <div
            className={`anomaly-checker-card${verdict.ifAnomaly ? ' is-anomaly' : ''}`}
          >
            <span className="anomaly-checker-card-label">Isolation Forest (5 features)</span>
            <span className="anomaly-checker-card-value">
              score = {verdict.ifScore.toFixed(3)}
            </span>
            <span className="anomaly-checker-verdict">{ifVerdict}</span>
            <span className="anomaly-checker-card-note">lower score is more anomalous</span>
          </div>

          <div className={`anomaly-checker-overlap${verdict.both ? ' is-both' : ''}`}>
            {overlap}
          </div>
        </div>
      </div>

      <div className="anomaly-checker-place">
        <p className="anomaly-checker-place-copy">
          Click anywhere on the map above to drop this reading at a location. The place is context
          only: the model judges the weather values, not where they are.
        </p>
        {placed && (
          <button type="button" className="anomaly-checker-clear" onClick={clearPlaced}>
            Clear placed point
          </button>
        )}
      </div>

      {/* Text equivalent of the read-outs for assistive tech (the cards above
          are aria-hidden to avoid reading the same numbers twice). */}
      <table className="visually-hidden">
        <caption>Live anomaly verdicts for the current reading</caption>
        <tbody>
          <tr>
            <th scope="row">Z-score on temperature</th>
            <td>
              z equals {verdict.z.z.toFixed(2)}, {zVerdict}
            </td>
          </tr>
          <tr>
            <th scope="row">Isolation Forest on five features</th>
            <td>
              score equals {verdict.ifScore.toFixed(3)}, {ifVerdict}
            </td>
          </tr>
          <tr>
            <th scope="row">Overlap</th>
            <td>{overlap}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
