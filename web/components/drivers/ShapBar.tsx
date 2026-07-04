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
 * Horizontal bars of `mean_abs_shap` per feature (dashboard-phase1.md § Section 3).
 * Sorted descending; direct mono value labels; a single-hue amber ramp keyed to
 * magnitude, built from the locked `--color-accent` token via `color-mix()`
 * (no new hex — see drivers.module.css header comment). The visible list IS the
 * accessible equivalent: feature name and value are real text, the bar itself
 * is `aria-hidden`.
 */
export default function ShapBar({ features }: ShapBarProps) {
  const sorted = [...features].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap);
  const maxValue = sorted.reduce((max, feature) => Math.max(max, feature.mean_abs_shap), 0) || 1;

  return (
    <div className={styles.barChart}>
      <Text type="label" className={styles.barChartCaption} as="div">
        Mean |SHAP| by feature, highest first
      </Text>
      <ul className={styles.barList}>
        {sorted.map((feature) => {
          const ratio = Math.max(0, feature.mean_abs_shap) / maxValue;
          const widthPct = Math.max(ratio * 100, 2);
          // Sequential amber ramp: 30%..100% mix of the locked accent token
          // over the surface token, so magnitude reads as depth of the same
          // single hue (DESIGN.md § Dataviz palette: "sequential ... for magnitude").
          const mixPct = Math.round(30 + ratio * 70);

          return (
            <li key={feature.name} className={styles.barRow}>
              <span className={styles.barLabel}>{humanizeFeatureName(feature.name)}</span>
              <span className={styles.barTrack} aria-hidden="true">
                <span
                  className={styles.barFill}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: `color-mix(in oklch, var(--color-accent) ${mixPct}%, var(--color-background-surface))`,
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
