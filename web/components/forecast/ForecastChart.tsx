'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { line } from 'd3-shape';
import type { ForecastPoint, ForecastSeriesData } from '../../lib/contract';

// A custom SVG line chart for the global temperature forecast (DESIGN.md
// § Section 1). Astryx has no chart layer, so this is hand-built; d3-scale
// gives the scales and d3-shape the line generator (both pure, CSR-safe).
//
// Fixed viewBox geometry: the SVG scales to its container width, so every
// coordinate lives in this internal system. All emitted coordinates are
// rounded to integers — this keeps the instrument crisp and, deliberately,
// guarantees no accidental two-decimal substring (e.g. the retracted "0.19")
// can ever appear inside a path `d`.
const VIEW_W = 920;
const VIEW_H = 400;
const MARGIN = { top: 16, right: 96, bottom: 34, left: 44 };
const PLOT_LEFT = MARGIN.left;
const PLOT_RIGHT = VIEW_W - MARGIN.right;
const PLOT_TOP = MARGIN.top;
const PLOT_BOTTOM = VIEW_H - MARGIN.bottom;

const round = (n: number): number => Math.round(n);
const parseDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

// °C values are shown to 2 dp (verified free of the retracted strings). Axis
// ticks stay integer / 1 dp so no incidental two-decimal value is emitted.
const fmtC = (v: number): string => v.toFixed(2);
const fmtTick = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d: Date): string => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const fmtDateStr = (iso: string): string => fmtDate(parseDate(iso));

interface SeriesSpec {
  id: string;
  label: string;
  /** A `var(--viz-*)` reference for the LINE stroke (bright, UI/marker >=3:1). */
  color: string;
  /** A `var(--viz-*-text)` reference for the direct end-LABEL text: small colored
   * text, so it is darkened in light mode to reach >=4.5:1 (DESIGN.md § Dataviz). */
  labelColor: string;
  width: number;
  points: ForecastPoint[];
}

// Back-to-front paint order: context first, the amber ensemble hero on top.
const DRAW_WEIGHT: Record<string, number> = {
  history: 0,
  prophet: 1,
  arima: 2,
  sarima: 3,
  lightgbm: 4,
  actual: 5,
  ensemble_weighted: 6,
};

interface HoverState {
  date: string;
  xPos: number;
  left: number;
  top: number;
  flip: boolean;
}

export interface ForecastChartProps {
  series: ForecastSeriesData;
}

export default function ForecastChart({ series }: ForecastChartProps) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [hover, setHover] = useState<HoverState | null>(null);
  // Draw-in animation runs only after mount and only when motion is allowed;
  // starting `false` means the prerendered/SSR output has static lines.
  const [animate, setAnimate] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setAnimate(!mq.matches);
  }, []);

  const allSeries = useMemo<SeriesSpec[]>(() => {
    const byId = new Map(series.models.map((m) => [m.id, m]));
    const model = (
      id: string,
      label: string,
      color: string,
      labelColor: string,
      width: number,
    ): SeriesSpec | null => {
      const m = byId.get(id);
      return m ? { id, label, color, labelColor, width, points: m.predictions } : null;
    };
    const list: Array<SeriesSpec | null> = [
      // actual/history are neutral text-tier colors (already >=4.5:1), so the
      // label reuses the line color; the five model series carry a darker
      // `-text` label variant for light-mode contrast.
      { id: 'actual', label: 'Actual', color: 'var(--viz-actual)', labelColor: 'var(--viz-actual)', width: 2.5, points: series.actual },
      model('ensemble_weighted', 'Ensemble', 'var(--viz-ensemble)', 'var(--viz-ensemble-text)', 2.5),
      model('lightgbm', 'LightGBM', 'var(--viz-lightgbm)', 'var(--viz-lightgbm-text)', 1.5),
      model('sarima', 'SARIMA', 'var(--viz-sarima)', 'var(--viz-sarima-text)', 1.5),
      model('arima', 'ARIMA', 'var(--viz-arima)', 'var(--viz-arima-text)', 1.5),
      model('prophet', 'Prophet', 'var(--viz-prophet)', 'var(--viz-prophet-text)', 1.5),
      { id: 'history', label: 'History', color: 'var(--viz-history)', labelColor: 'var(--viz-history)', width: 1, points: series.history },
    ];
    return list.filter((s): s is SeriesSpec => s !== null);
  }, [series]);

  const { x, y, yTicks, xTicks } = useMemo(() => {
    const allPts = allSeries.flatMap((s) => s.points);
    const times = allPts.map((p) => parseDate(p.date).getTime());
    const vals = allPts.map((p) => p.value);
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    const pad = (vMax - vMin) * 0.08 || 1;
    const xs = scaleUtc()
      .domain([new Date(Math.min(...times)), new Date(Math.max(...times))])
      .range([PLOT_LEFT, PLOT_RIGHT]);
    const ys = scaleLinear()
      .domain([vMin - pad, vMax + pad])
      .nice()
      .range([PLOT_BOTTOM, PLOT_TOP]);
    return { x: xs, y: ys, yTicks: ys.ticks(6), xTicks: xs.ticks(6) };
  }, [allSeries]);

  const pathFor = useMemo(() => {
    const gen = line<ForecastPoint>()
      .x((p) => round(x(parseDate(p.date))))
      .y((p) => round(y(p.value)));
    return (pts: ForecastPoint[]): string => gen(pts) ?? '';
  }, [x, y]);

  // date -> value per series, for the hover readout and the a11y table.
  const valueMaps = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const s of allSeries) {
      const dm = new Map<string, number>();
      for (const p of s.points) dm.set(p.date, p.value);
      m.set(s.id, dm);
    }
    return m;
  }, [allSeries]);

  // Every date (ISO strings sort chronologically) with its x pixel, for hover
  // snapping and the a11y table rows.
  const datePositions = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSeries) for (const p of s.points) set.add(p.date);
    return [...set].sort().map((date) => ({ date, xPos: round(x(parseDate(date))) }));
  }, [allSeries, x]);

  const maxDate = datePositions.length ? datePositions[datePositions.length - 1].date : '';
  const xBoundary = round(x(parseDate(series.train_end)));

  const drawSeries = useMemo(
    () => [...allSeries].sort((a, b) => (DRAW_WEIGHT[a.id] ?? 0) - (DRAW_WEIGHT[b.id] ?? 0)),
    [allSeries],
  );

  // Direct end-labels on the right-edge series, de-cluttered vertically so
  // near-overlapping model endpoints stay legible (DESIGN.md: not legend-only).
  const endLabels = useMemo(() => {
    const gap = 13;
    const placed = allSeries
      .filter((s) => !hidden.has(s.id))
      .map((s) => ({ s, last: s.points[s.points.length - 1] as ForecastPoint | undefined }))
      .filter((e): e is { s: SeriesSpec; last: ForecastPoint } => !!e.last && e.last.date === maxDate)
      .map((e) => ({
        id: e.s.id,
        label: e.s.label,
        labelColor: e.s.labelColor,
        y0: round(y(e.last.value)),
        yLabel: round(y(e.last.value)),
      }))
      .sort((a, b) => a.y0 - b.y0);
    for (let i = 1; i < placed.length; i++) {
      if (placed[i].yLabel < placed[i - 1].yLabel + gap) placed[i].yLabel = placed[i - 1].yLabel + gap;
    }
    if (placed.length && placed[placed.length - 1].yLabel > PLOT_BOTTOM) {
      placed[placed.length - 1].yLabel = PLOT_BOTTOM;
      for (let i = placed.length - 2; i >= 0; i--) {
        if (placed[i].yLabel > placed[i + 1].yLabel - gap) placed[i].yLabel = placed[i + 1].yLabel - gap;
      }
    }
    return placed;
  }, [allSeries, hidden, y, maxDate]);

  const readoutItems = hover
    ? allSeries
        .filter((s) => !hidden.has(s.id) && valueMaps.get(s.id)?.has(hover.date))
        .map((s) => ({
          id: s.id,
          label: s.label,
          color: s.color,
          value: valueMaps.get(s.id)?.get(hover.date) as number,
        }))
    : [];

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const chart = chartRef.current;
    if (!svg || !chart || datePositions.length === 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const vx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    if (vx < PLOT_LEFT || vx > PLOT_RIGHT) {
      setHover(null);
      return;
    }
    let nearest = datePositions[0];
    let best = Infinity;
    for (const dp of datePositions) {
      const d = Math.abs(dp.xPos - vx);
      if (d < best) {
        best = d;
        nearest = dp;
      }
    }
    const chartRect = chart.getBoundingClientRect();
    const left = e.clientX - chartRect.left;
    setHover({
      date: nearest.date,
      xPos: nearest.xPos,
      left,
      top: e.clientY - chartRect.top,
      flip: left > chartRect.width * 0.6,
    });
  };

  return (
    <div className="forecast-chart" ref={chartRef}>
      <div className="forecast-chart-wrap">
        <svg
          ref={svgRef}
          className="forecast-chart-svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label="Line chart of daily global mean temperature in degrees Celsius: training history, the 30-day holdout actuals, and five model forecasts. The equivalent data table follows."
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Horizontal gridlines + y-axis (°C) tick labels. */}
          {yTicks.map((t) => {
            const yp = round(y(t));
            return (
              <g key={`y-${t}`}>
                <line className="forecast-grid-line" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={yp} y2={yp} />
                <text className="forecast-tick-label" x={PLOT_LEFT - 8} y={yp + 4} textAnchor="end">
                  {fmtTick(t)}
                </text>
              </g>
            );
          })}
          <text className="forecast-axis-title" x={PLOT_LEFT - 8} y={PLOT_TOP - 4} textAnchor="start">
            °C
          </text>

          {/* Bottom x-axis with precision ticks + date labels. */}
          <line className="forecast-axis-line" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} />
          {xTicks.map((t) => {
            const xp = round(x(t));
            return (
              <g key={`x-${t.getTime()}`}>
                <line className="forecast-axis-line" x1={xp} x2={xp} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM + 4} />
                <text className="forecast-tick-label" x={xp} y={PLOT_BOTTOM + 18} textAnchor="middle">
                  {fmtDate(t)}
                </text>
              </g>
            );
          })}

          {/* Train / holdout boundary at train_end. */}
          <line className="forecast-boundary-line" x1={xBoundary} x2={xBoundary} y1={PLOT_TOP} y2={PLOT_BOTTOM} />
          <text className="forecast-boundary-label" x={xBoundary + 4} y={PLOT_TOP + 10} textAnchor="start">
            Holdout
          </text>

          {/* Series lines (context first, amber ensemble hero last). */}
          {drawSeries
            .filter((s) => !hidden.has(s.id))
            .map((s) => (
              <path
                key={s.id}
                className={animate ? 'forecast-series-line forecast-series-line--draw' : 'forecast-series-line'}
                d={pathFor(s.points)}
                pathLength={1}
                style={{ stroke: s.color }}
                strokeWidth={s.width}
              />
            ))}

          {/* Direct end-labels with short leader lines. */}
          {endLabels.map((l) => (
            <g key={`end-${l.id}`}>
              {/* Leader + label share the darker `-text` variant so both clear
                  contrast (label >=4.5:1 text, leader >=3:1 UI stroke) in light
                  mode; the plotted line above keeps the bright series color. */}
              <line
                x1={PLOT_RIGHT}
                y1={l.y0}
                x2={PLOT_RIGHT + 5}
                y2={l.yLabel}
                style={{ stroke: l.labelColor }}
                strokeWidth={1}
              />
              <text
                className="forecast-endlabel"
                x={PLOT_RIGHT + 8}
                y={l.yLabel + 3}
                textAnchor="start"
                style={{ fill: l.labelColor }}
              >
                {l.label}
              </text>
            </g>
          ))}

          {/* Hover crosshair + per-series dots. */}
          {hover && (
            <line className="forecast-crosshair" x1={hover.xPos} x2={hover.xPos} y1={PLOT_TOP} y2={PLOT_BOTTOM} />
          )}
          {hover &&
            readoutItems.map((it) => (
              <circle
                key={`dot-${it.id}`}
                className="forecast-hover-dot"
                cx={hover.xPos}
                cy={round(y(it.value))}
                r={3}
                style={{ fill: it.color }}
              />
            ))}
        </svg>

        {hover && readoutItems.length > 0 && (
          <div
            className="forecast-readout"
            style={{
              left: hover.left,
              top: hover.top,
              transform: hover.flip ? 'translate(calc(-100% - 14px), 8px)' : 'translate(14px, 8px)',
            }}
          >
            <div className="forecast-readout-date">{fmtDateStr(hover.date)}</div>
            {readoutItems.map((it) => (
              <div className="forecast-readout-row" key={`ro-${it.id}`}>
                <span className="forecast-readout-swatch" style={{ background: it.color }} aria-hidden="true" />
                <span className="forecast-readout-label">{it.label}</span>
                <span className="forecast-readout-value">{fmtC(it.value)} °C</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard-operable legend that toggles each series. */}
      <div className="forecast-legend" role="group" aria-label="Toggle forecast series">
        {allSeries.map((s) => {
          const on = !hidden.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className="forecast-legend-btn"
              aria-pressed={on}
              onClick={() => toggle(s.id)}
            >
              <span className="forecast-legend-swatch" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Accessible text equivalent of the chart (visually hidden). */}
      <table className="visually-hidden">
        <caption>Daily global mean temperature by series, in degrees Celsius.</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {allSeries.map((s) => (
              <th scope="col" key={`h-${s.id}`}>
                {s.label} (°C)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datePositions.map(({ date }) => (
            <tr key={`r-${date}`}>
              <th scope="row">{date}</th>
              {allSeries.map((s) => {
                const v = valueMaps.get(s.id)?.get(date);
                return <td key={`c-${s.id}-${date}`}>{v === undefined ? '' : fmtC(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
