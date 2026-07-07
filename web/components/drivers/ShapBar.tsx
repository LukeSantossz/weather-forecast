'use client';

import { useEffect, useRef, useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import type { ShapFeature } from '../../lib/contract';
import styles from './drivers.module.css';

export interface ShapBarProps {
  features: ShapFeature[];
}

/** `temperature_celsius` -> `Temperature Celsius`. A plain, non-invented label:
 * the underlying feature name transcribed with underscores as spaces, not a
 * re-authored/unit-annotated description. */
function humanizeFeatureName(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatShapValue(value: number): string {
  return value.toFixed(2);
}

/**
 * Horizontal bars of `mean_abs_shap` per feature (dashboard-phase1.md § Section 3),
 * ported from the approved observatory design preview's `.shap`/`.srow`/`.sbar`.
 * Sorted descending (standard
 * SHAP importance ordering); direct mono value labels; a cool -> warm ramp keyed
 * to each feature's own magnitude (its `mean_abs_shap` as a fraction of the
 * largest one in this sample), built from the locked `--color-info` (cool pole)
 * and `--color-accent` (warm pole) tokens via `color-mix(in srgb, ...)` - a
 * direct per-channel blend, matching the brief's literal `mix(#3fa9c7,
 * #f2612c, value/max)` formula (mixing `in oklch` instead was tried first and
 * rejected: interpolating hue the short way between this orange and this
 * teal-blue swings through a garish magenta band at the ramp's midpoint,
 * confirmed in-browser). Same token pair and interpolation space as
 * ShapBeeswarm's `dotColor`, so the drivers act reads as one consistent
 * diverging scale (no new hex). Bars grow in from zero width the
 * first time this list scrolls into view (IntersectionObserver, threshold 0.2,
 * matching the template); under `prefers-reduced-motion: reduce` they render at
 * full width immediately instead, with no transition (see the CSS backstop in
 * drivers.module.css). The visible list IS the accessible equivalent: feature
 * name and value are real text, the bar itself is `aria-hidden`.
 */
export default function ShapBar({ features }: ShapBarProps) {
  const sorted = [...features].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap);
  const maxValue = sorted.reduce((max, feature) => Math.max(max, feature.mean_abs_shap), 0) || 1;

  const listRef = useRef<HTMLUListElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // Static when reduced: skip the observer entirely and show the real
      // widths right away (the CSS backstop below also disables the
      // transition, so this can never animate even if this branch were
      // somehow bypassed).
      setRevealed(true);
      return;
    }

    const node = listRef.current;
    if (!node) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.barChart}>
      <Text type="label" className={styles.barChartCaption} as="div">
        Mean |SHAP| by feature, highest first
      </Text>
      <ul className={styles.barList} ref={listRef}>
        {sorted.map((feature, index) => {
          const ratio = Math.max(0, feature.mean_abs_shap) / maxValue;
          const widthPct = Math.max(ratio * 100, 2);
          // Cool -> warm magnitude ramp: mix(#3fa9c7, #f2612c, value/max) from
          // the task brief, expressed as this project's token pair so both
          // themes stay correct (--color-info's dark value is #3fa9c7,
          // --color-accent's is #f2612c - the exact pair named in the brief).
          const warmPct = Math.round(ratio * 100);

          return (
            <li key={feature.name} className={styles.barRow}>
              <span className={styles.barLabel}>{humanizeFeatureName(feature.name)}</span>
              <span className={styles.barTrack} aria-hidden="true">
                <span
                  className={styles.barFill}
                  style={{
                    width: revealed ? `${widthPct}%` : '0%',
                    transitionDelay: `${index * 55}ms`,
                    backgroundColor: `color-mix(in srgb, var(--color-accent) ${warmPct}%, var(--color-info) ${100 - warmPct}%)`,
                  }}
                />
              </span>
              <span className={styles.barValue}>{formatShapValue(feature.mean_abs_shap)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
