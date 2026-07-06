'use client';

import { useId, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import type { ShapBeeswarmSeries, ShapFeature } from '../../lib/contract';
import styles from './drivers.module.css';

export interface ShapBeeswarmProps {
  features: ShapFeature[];
  beeswarm: ShapBeeswarmSeries[];
}

/** Same plain transcription rule as ShapBar's label (kept local: three lines,
 * not worth a shared module for). */
function humanizeFeatureName(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatShapValue(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function pickTopFeature(features: ShapFeature[]): ShapFeature | undefined {
  return [...features].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap)[0];
}

/**
 * A simple, deterministic lean: the covariance-sign of (shap, feature_value_norm)
 * over the series' downsampled points. Positive => higher feature values tend
 * to sit on the positive (pushes-up) side; negative => the opposite. Returns
 * `null` when there is nothing to say (no points, or an exact tie).
 */
function directionForSeries(series: ShapBeeswarmSeries | undefined): 'up' | 'down' | null {
  if (!series || series.points.length === 0) return null;
  let lean = 0;
  for (const point of series.points) {
    lean += point.shap * (point.feature_value_norm - 0.5);
  }
  if (lean === 0) return null;
  return lean > 0 ? 'up' : 'down';
}

/** Deterministic pseudo-random in [0, 1), seeded by index. Avoids Math.random
 * so the static export's server-rendered markup matches client hydration. */
function jitterFor(index: number): number {
  const seed = Math.sin(index * 12.9898) * 43758.5453;
  return seed - Math.floor(seed);
}

/** Maps a value from the shared symmetric domain [-domainMax, domainMax] to
 * a 0-100 percentage of the row's width. A percentage (not a fixed pixel
 * width) keeps each row's dots positioned correctly at any container width
 * without the non-uniform-scaling distortion an SVG `viewBox` would need. */
function scaleXPercent(value: number, domainMax: number): number {
  if (domainMax === 0) return 50;
  const clamped = Math.max(-domainMax, Math.min(domainMax, value));
  return ((clamped + domainMax) / (2 * domainMax)) * 100;
}

/** Diverging color for a single point, keyed by its own `feature_value_norm`
 * (0 = low value, 1 = high value) - DESIGN.md § Dataviz: the amber(high)
 * <-> cyan(low) diverging pair, built via `color-mix()` from the locked
 * `--color-accent` / `--color-info` tokens (no new hex). Mixed `in srgb`
 * (plain per-channel blending, matching the brief's `mix(#3fa9c7, #f2612c,
 * t)` formula) rather than `in oklch`: interpolating hue between this
 * accent's orange (~39°) and this info's teal-blue (~230°) takes the
 * *shorter* arc, which runs backward through magenta/purple instead of
 * through a sensible warm<->cool midpoint - confirmed in-browser, visible as
 * a garish pink band across the mid-magnitude dots/bars. `in srgb` blends the
 * R/G/B channels directly, so the midpoint reads as a muted warm/cool blend
 * instead. This is the ONLY channel colored by hue in this chart: SHAP
 * push-direction (the x position) is conveyed by position plus the words in
 * the axis line + legend below, so no single color stands in for two
 * different meanings at once. */
function dotColor(norm: number): string {
  const clamped = Math.max(0, Math.min(1, norm));
  const amberPct = Math.round(clamped * 100);
  return `color-mix(in srgb, var(--color-accent) ${amberPct}%, var(--color-info) ${100 - amberPct}%)`;
}

const ROW_HEIGHT = 36;
const ROW_CENTER_Y = ROW_HEIGHT / 2;
const JITTER_RANGE = 22;

/**
 * Per-feature strip-plot rows of the downsampled SHAP beeswarm points
 * (dashboard-phase1.md § Section 3). x = SHAP value on a shared, zero-centered
 * scale (position conveys push-up/push-down, labeled in words on the shared
 * axis line); dot color = that point's own `feature_value_norm` on the
 * amber(high)/cyan(low) diverging scale. Collapses to a "Show detail" toggle
 * on narrow screens, leaving ShapBar as the always-visible fallback.
 */
export default function ShapBeeswarm({ features, beeswarm }: ShapBeeswarmProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailId = useId();

  const orderedNames = [...features].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap).map((f) => f.name);
  const seriesByName = new Map(beeswarm.map((series) => [series.feature, series] as const));
  const orderedSeries = orderedNames
    .map((name) => seriesByName.get(name))
    .filter((series): series is ShapBeeswarmSeries => series !== undefined);

  const domainMax =
    orderedSeries.reduce((max, series) => {
      const seriesMax = series.points.reduce((m, p) => Math.max(m, Math.abs(p.shap)), 0);
      return Math.max(max, seriesMax);
    }, 0) || 1;

  const topFeature = pickTopFeature(features);
  const topSeries = topFeature ? seriesByName.get(topFeature.name) : undefined;
  const direction = directionForSeries(topSeries);
  const reading =
    topFeature && direction
      ? `Higher ${humanizeFeatureName(topFeature.name)} pushes predicted PM2.5 ${direction}.`
      : 'No clear up/down lean in this sample.';

  return (
    <div className={styles.beeswarmSection}>
      <div className={styles.beeswarmHeaderRow}>
        <Text type="label" className={styles.beeswarmCaption} as="div">
          SHAP value by feature (per-point detail)
        </Text>
        <Button
          className={styles.beeswarmDetailToggle}
          label={isDetailOpen ? 'Hide detail' : 'Show detail'}
          variant="ghost"
          size="sm"
          aria-expanded={isDetailOpen}
          aria-controls={detailId}
          onClick={() => setIsDetailOpen((open) => !open)}
        />
      </div>

      <div id={detailId} className={styles.beeswarmDetailBody} data-open={isDetailOpen ? 'true' : 'false'}>
        <p className={styles.beeswarmReading}>{reading}</p>

        <div className={styles.beeswarmLegend}>
          <div className={styles.beeswarmLegendItem}>
            <span
              className={styles.beeswarmLegendSwatch}
              style={{ backgroundColor: 'var(--color-border)' }}
              aria-hidden="true"
            />
            <span>
              <strong>Position</strong>: how much that point shifts the predicted PM2.5. Left of the center
              tick pushes the prediction down, right pushes it up.
            </span>
          </div>
          <div className={styles.beeswarmLegendItem}>
            <span
              className={styles.beeswarmLegendSwatch}
              style={{
                backgroundColor: 'color-mix(in oklch, var(--color-accent) 85%, var(--color-info) 15%)',
              }}
              aria-hidden="true"
            />
            <span>
              <strong>Color</strong>: that point&apos;s own feature value. Amber is a high value, cyan is a low
              value.
            </span>
          </div>
        </div>

        <div className={styles.beeswarmAxis} aria-hidden="true">
          <span>{formatShapValue(-domainMax)} · pushes down</span>
          <span>0</span>
          <span>pushes up · {formatShapValue(domainMax)}</span>
        </div>

        <div className={styles.beeswarmRows}>
          {orderedSeries.map((series) => {
            const shapValues = series.points.map((p) => p.shap);
            const min = shapValues.length ? Math.min(...shapValues) : 0;
            const max = shapValues.length ? Math.max(...shapValues) : 0;

            return (
              <div key={series.feature} className={styles.beeswarmRow}>
                <span className={styles.beeswarmRowLabel}>{humanizeFeatureName(series.feature)}</span>
                <div className={styles.beeswarmRowPlot} style={{ height: ROW_HEIGHT }} aria-hidden="true">
                  <span className={styles.beeswarmZeroLine} />
                  {series.points.map((point, index) => (
                    <span
                      key={index}
                      className={styles.beeswarmDot}
                      title={`SHAP ${formatShapValue(point.shap)} · feature value percentile ${Math.round(point.feature_value_norm * 100)}%`}
                      style={{
                        left: `${scaleXPercent(point.shap, domainMax)}%`,
                        top: `${ROW_CENTER_Y + (jitterFor(index) - 0.5) * JITTER_RANGE}px`,
                        backgroundColor: dotColor(point.feature_value_norm),
                      }}
                    />
                  ))}
                </div>
                <span className={styles.beeswarmRowSummary}>
                  n={series.points.length} · {formatShapValue(min)}…{formatShapValue(max)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
