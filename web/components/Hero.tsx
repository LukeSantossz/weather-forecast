'use client';

import { useEffect, useMemo, useState } from 'react';
import forecastData from '../public/data/forecast.json';
import metricsData from '../public/data/metrics.json';
import type { Forecast, Metrics, MetricsModel } from '../lib/contract';

// Direct JSON import (same pattern as components/DataStatusBanner.tsx), not
// lib/contract.ts's fetch-based loadForecast/loadMetrics: the hero is the
// first thing painted, above the fold, and needs the real numbers and the
// 120-day series synchronously on first render (no loading skeleton, no
// fetch waterfall before the stripes can compute their color scale). Static
// export inlines both JSON files at build time either way.
const forecast = forecastData as Forecast;
const metrics = metricsData as Metrics;

// Diverging temperature scale (DESIGN.md-locked hex, ported verbatim from the
// Observatory preview template's HERO STRIPES IIFE - docs/design/
// observatory-preview-template.html): cool -> neutral -> warm. These three
// hex values are the scale's fixed endpoints/midpoint, not a themed token, so
// they render identically in light and dark (same convention as the other
// off-token hex already locked in app/theme.css).
type Rgb = [number, number, number];

function hex2rgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const COOL: Rgb = hex2rgb('#3fa9c7');
const MID: Rgb = hex2rgb('#c9c3b6');
const WARM: Rgb = hex2rgb('#f2612c');

function tempColor(value: number, min: number, max: number): string {
  const p = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const rgb = p < 0.5 ? mix(COOL, MID, p * 2) : mix(MID, WARM, (p - 0.5) * 2);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// The 120-day observed series the stripes render (90 history days + the
// 30-day holdout actuals - series.history.concat(series.actual), per the
// contract). Module-level: the underlying JSON is static, so this only needs
// computing once, not per render/instance.
const OBSERVED = forecast.series.history.concat(forecast.series.actual);

export default function Hero() {
  // Both start false so the server-rendered / first-paint markup matches the
  // template's own initial state (stripes collapsed to scaleY(0)); the effect
  // below corrects for prefers-reduced-motion and then triggers the reveal,
  // same as ForecastChart.tsx's identical `animate` boot sequence.
  const [reduceMotion, setReduceMotion] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduceMotion(reduce);

    if (reduce) {
      // Reduced motion: stripes are static and fully shown immediately, no
      // scale animation (the .stripes span CSS backstop in theme.css also
      // forces transform:none, but this skips the transition/delay entirely).
      setRevealed(true);
      return;
    }

    // Double rAF (ported from the template's HERO STRIPES IIFE): the initial
    // scaleY(0) paint must settle in the browser before flipping to
    // scaleY(1), or the per-span transition never runs.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setRevealed(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  const stripes = useMemo(() => {
    const temps = OBSERVED.map((d) => d.value);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    return OBSERVED.map((d, i) => ({
      key: `${d.date}-${i}`,
      color: tempColor(d.value, min, max),
    }));
  }, []);

  // Hero stats: best `final` model by minimum rmse_c, 211 countries (a
  // template literal, not a contract field), the holdout window, and the
  // model count - all from forecast.json / metrics.json, no invented fields.
  // Every model in the committed metrics.json is status "final", so
  // `finalModels` always has a row to pick from in practice - but
  // `MetricsStatus` allows every model to be `pending_rerun`, and the hero
  // has no error boundary above it (it's the first thing painted), so this
  // guards the empty case the same way ForecastSection.tsx:67-71 does
  // (finals.length ? finals.reduce(...) : null) rather than letting an
  // unguarded `.reduce()` throw `TypeError: Reduce of empty array`. The
  // filter's type predicate narrows `rmse_c` to `number` for real, so the
  // `as number` casts below are gone.
  const finalModels = metrics.models.filter(
    (m): m is MetricsModel & { rmse_c: number } => m.status === 'final' && m.rmse_c !== null,
  );
  const bestModel = finalModels.length
    ? finalModels.reduce((a, b) => (a.rmse_c <= b.rmse_c ? a : b))
    : null;

  const heroStats: Array<{ value: string; suffix: string; label: string }> = [
    {
      value: bestModel ? bestModel.rmse_c.toFixed(2) : '—',
      suffix: '°C RMSE',
      label: bestModel ? `Best model · ${bestModel.name.split(' ')[0]}` : 'Best model',
    },
    { value: '211', suffix: '', label: 'Countries scored' },
    { value: String(forecast.series.test_window_days), suffix: 'days', label: 'Untouched holdout' },
    { value: String(metrics.models.length), suffix: '', label: 'Models benchmarked' },
  ];

  return (
    <section className="hero">
      <div className="stripes" aria-hidden="true">
        {stripes.map((s, i) => (
          <span
            key={s.key}
            style={{
              background: s.color,
              transform: revealed ? 'scaleY(1)' : 'scaleY(0)',
              transition: reduceMotion
                ? 'none'
                : `transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 22}ms`,
            }}
          />
        ))}
      </div>
      <div className="hero-veil" />
      <div className="hero-in">
        <div className="eyebrow">Global daily-mean temperature · 211 countries</div>
        <h1 className="title">
          Forecasting the planet&apos;s temperature to within a <em>quarter‑degree</em>.
        </h1>
        <p className="lede">
          An end-to-end machine-learning pipeline that predicts global daily temperature, flags the
          outliers, and explains what drives them. Every figure is regenerated from source and stamped
          to the commit that produced it.
        </p>
        <div className="herostats">
          {heroStats.map((s) => (
            <div className="hstat" key={s.label}>
              <div className="v mono">
                {s.value}
                {s.suffix && <small>{s.suffix}</small>}
              </div>
              <div className="k">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="scrollcue">
          <span className="ln" aria-hidden="true" />
          Three findings, in order
        </div>
      </div>
    </section>
  );
}
