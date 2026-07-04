'use client';

// MapLibre's own stylesheet (popups, controls, canvas positioning). This sits
// in AnomalyMap's chunk, which AnomaliesSection loads via next/dynamic
// (ssr:false) only once the section is visible, so it is never in the main
// bundle or the prerendered HTML. The heavy maplibre-gl *module* is loaded
// separately with a dynamic import() in the mount effect below.
import 'maplibre-gl/dist/maplibre-gl.css';

import { useEffect, useRef, useState } from 'react';
import type {
  MapLibreMap,
  Popup as MapLibrePopup,
  GeoJSONSource,
  MapGeoJSONFeature,
  LayerSpecification,
  FilterSpecification,
} from 'maplibre-gl';
import type { AnomalyRecord, AnomalyDetectedBy } from '../../lib/contract';

type MaplibreModule = typeof import('maplibre-gl');

export interface AnomalyMapProps {
  records: AnomalyRecord[];
  /** Index into `records` of the highlighted marker, or null. */
  selectedIndex: number | null;
  /** Clicking a marker selects it (kept in sync with the records list). */
  onSelect: (index: number | null) => void;
}

// DESIGN.md § Anomaly explorer: a graphite dark / light map matching the theme,
// via a free keyless style. CARTO's dark-matter (graphite) and positron (light)
// GL basemaps are served from the open CARTO CDN (glyphs, sprite, and OSM
// vector tiles included) with no API key.
const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const SRC = 'anomalies';
const LAYER_FILL = 'anomaly-points';
// A larger, near-invisible circle under the visible markers, giving a ~44px
// touch/hover target (DESIGN.md § Accessibility). Pointer events bind here.
const LAYER_HIT = 'anomaly-hit';

const ALL_METHODS: AnomalyDetectedBy[] = ['zscore', 'isolation_forest', 'both'];

const METHOD_NAME: Record<AnomalyDetectedBy, string> = {
  zscore: 'Z-score',
  isolation_forest: 'Isolation Forest',
  both: 'Both methods',
};

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function styleUrl(theme: 'light' | 'dark'): string {
  return theme === 'light' ? STYLE_LIGHT : STYLE_DARK;
}

// Resolve a CSS token (e.g. "var(--color-info)") to a concrete rgb() string.
// WebGL paint properties cannot read CSS variables, so the markers stay bound
// to the same theme.css tokens as the rest of the UI by resolving them here
// (light-dark() is evaluated because `color` is a real, computed property).
function resolveColor(cssExpr: string): string {
  const probe = document.createElement('span');
  probe.style.color = cssExpr;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || cssExpr;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

function popupHtml(r: AnomalyRecord): string {
  return (
    `<div class="anomaly-popup-country">${escapeHtml(r.country)}</div>` +
    `<div class="anomaly-popup-row">${r.ts.slice(0, 10)} · ${METHOD_NAME[r.detected_by]}</div>` +
    `<div class="anomaly-popup-row">${r.temp_c.toFixed(1)} °C · z ${r.z.toFixed(2)} · if ${r.if_score.toFixed(2)}</div>`
  );
}

function pointCoords(feature: MapGeoJSONFeature): [number, number] | null {
  const geometry = feature.geometry;
  if (geometry.type !== 'Point') return null;
  const [lon, lat] = geometry.coordinates;
  return [lon, lat];
}

function toFeatureCollection(records: AnomalyRecord[]) {
  return {
    type: 'FeatureCollection' as const,
    features: records.map((r, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
      properties: { i, ...r },
    })),
  };
}

function filterFor(active: Set<AnomalyDetectedBy>): FilterSpecification | null {
  if (ALL_METHODS.every((m) => active.has(m))) return null;
  return ['in', ['get', 'detected_by'], ['literal', Array.from(active)]] as FilterSpecification;
}

// DESIGN.md § Anomaly explorer: point markers (a circle layer, NOT a
// choropleth), coloured by detection method, sized by |z|, hover tooltip,
// legend filter, and no fly-to under reduced motion. The records list is the
// keyboard-accessible equivalent.
export default function AnomalyMap({ records, selectedIndex, onSelect }: AnomalyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const maplibreRef = useRef<MaplibreModule | null>(null);
  const readyRef = useRef(false);

  // Refs mirror the latest props so the imperative map handlers (attached once)
  // always read current values without re-subscribing.
  const recordsRef = useRef(records);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedIndex);
  const prevSelectedRef = useRef<number | null>(null);
  const activeMethodsRef = useRef<Set<AnomalyDetectedBy>>(new Set(ALL_METHODS));
  // Imperative API published by the mount effect, so the prop-driven effects
  // below can drive the map without re-running setup.
  const apiRef = useRef<{ applyFilter: () => void; applySelection: () => void } | null>(null);

  recordsRef.current = records;
  onSelectRef.current = onSelect;
  selectedRef.current = selectedIndex;

  const [activeMethods, setActiveMethods] = useState<Set<AnomalyDetectedBy>>(new Set(ALL_METHODS));
  activeMethodsRef.current = activeMethods;

  const methodCounts = ALL_METHODS.reduce(
    (acc, m) => {
      acc[m] = records.filter((r) => r.detected_by === m).length;
      return acc;
    },
    { zscore: 0, isolation_forest: 0, both: 0 } as Record<AnomalyDetectedBy, number>,
  );

  useEffect(() => {
    let cancelled = false;
    let themeObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      // UMD build: named exports (Map, Popup, ...) live on the module
      // namespace; some bundler interops mirror the same object under
      // `.default`. Take whichever is present.
      const imported = (await import('maplibre-gl')) as MaplibreModule & { default?: MaplibreModule };
      const maplibre = imported.default ?? imported;
      if (cancelled || !containerRef.current) return;
      maplibreRef.current = maplibre;

      const map = new maplibre.Map({
        container: containerRef.current,
        style: styleUrl(currentTheme()),
        center: [0, 20],
        zoom: 1.3,
        attributionControl: { compact: true },
        renderWorldCopies: true,
      });
      mapRef.current = map;
      popupRef.current = new maplibre.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'anomaly-popup',
        offset: 14,
        maxWidth: '260px',
      });

      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

      const addAnomalyLayers = () => {
        const data = toFeatureCollection(recordsRef.current);
        const existing = map.getSource(SRC) as GeoJSONSource | undefined;
        if (existing) {
          existing.setData(data);
        } else {
          map.addSource(SRC, { type: 'geojson', data });
        }

        const info = resolveColor('var(--color-info)');
        const violet = resolveColor('var(--color-violet)');
        const danger = resolveColor('var(--color-danger)');
        const accent = resolveColor('var(--color-accent)');
        const ring = resolveColor('var(--color-background-surface)');

        // maplibre models paint expressions as deep tuple unions that reject
        // programmatically-built arrays; assert at this single, runtime-validated
        // boundary (maplibre still throws on a genuinely malformed spec).
        if (!map.getLayer(LAYER_HIT)) {
          map.addLayer({
            id: LAYER_HIT,
            type: 'circle',
            source: SRC,
            paint: { 'circle-radius': 22, 'circle-color': ring, 'circle-opacity': 0.01 },
          } as unknown as LayerSpecification);
        }
        if (!map.getLayer(LAYER_FILL)) {
          map.addLayer({
            id: LAYER_FILL,
            type: 'circle',
            source: SRC,
            paint: {
              'circle-color': [
                'match',
                ['get', 'detected_by'],
                'zscore',
                info,
                'isolation_forest',
                violet,
                'both',
                danger,
                info,
              ],
              'circle-radius': ['interpolate', ['linear'], ['abs', ['get', 'z']], 3, 5, 4.6, 13],
              'circle-opacity': 0.85,
              'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1],
              'circle-stroke-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                accent,
                ring,
              ],
            },
          } as unknown as LayerSpecification);
        }
      };

      const applyFilter = () => {
        if (!readyRef.current) return;
        const f = filterFor(activeMethodsRef.current);
        if (map.getLayer(LAYER_FILL)) map.setFilter(LAYER_FILL, f);
        if (map.getLayer(LAYER_HIT)) map.setFilter(LAYER_HIT, f);
      };

      const applySelection = () => {
        if (!readyRef.current || !map.getSource(SRC)) return;
        const prev = prevSelectedRef.current;
        if (prev !== null) map.setFeatureState({ source: SRC, id: prev }, { selected: false });
        const sel = selectedRef.current;
        if (sel !== null) {
          map.setFeatureState({ source: SRC, id: sel }, { selected: true });
          const r = recordsRef.current[sel];
          if (r) {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const target = { center: [r.lon, r.lat] as [number, number], zoom: Math.max(map.getZoom(), 3) };
            // DESIGN.md: no fly-to under reduced motion.
            if (reduce) map.jumpTo(target);
            else map.easeTo({ ...target, duration: 600 });
          }
        }
        prevSelectedRef.current = sel;
      };

      apiRef.current = { applyFilter, applySelection };

      map.on('load', () => {
        addAnomalyLayers();
        const recs = recordsRef.current;
        if (recs.length > 0) {
          const bounds = new maplibre.LngLatBounds();
          recs.forEach((r) => bounds.extend([r.lon, r.lat]));
          map.fitBounds(bounds, { padding: 48, maxZoom: 4.5, animate: false });
        }
        readyRef.current = true;
        applyFilter();
        applySelection();
      });

      map.on('mousemove', LAYER_HIT, (e) => {
        const popup = popupRef.current;
        if (!popup || !e.features || e.features.length === 0) return;
        map.getCanvas().style.cursor = 'pointer';
        const coords = pointCoords(e.features[0]);
        if (!coords) return;
        popup.setLngLat(coords).setHTML(popupHtml(e.features[0].properties as AnomalyRecord)).addTo(map);
      });
      map.on('mouseleave', LAYER_HIT, () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
      });
      map.on('click', LAYER_HIT, (e) => {
        if (!e.features || e.features.length === 0) return;
        onSelectRef.current(Number((e.features[0].properties as { i: number }).i));
      });

      // Re-theme the base map when the console theme toggles; re-add our
      // source/layers (setStyle clears them) with freshly resolved colours.
      themeObserver = new MutationObserver(() => {
        map.setStyle(styleUrl(currentTheme()));
        map.once('styledata', () => {
          addAnomalyLayers();
          applyFilter();
          applySelection();
        });
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      resizeObserver?.disconnect();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      apiRef.current = null;
      readyRef.current = false;
      prevSelectedRef.current = null;
    };
  }, []);

  useEffect(() => {
    apiRef.current?.applySelection();
  }, [selectedIndex]);

  useEffect(() => {
    apiRef.current?.applyFilter();
  }, [activeMethods]);

  const toggleMethod = (method: AnomalyDetectedBy) => {
    setActiveMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) next.delete(method);
      else next.add(method);
      // Never leave the map fully blank: re-enabling all when the last is
      // toggled off would surprise; instead an empty set simply shows nothing,
      // and the button labels make the state explicit.
      return next;
    });
  };

  return (
    <div className="anomaly-map-wrap">
      <div
        ref={containerRef}
        className="anomaly-map"
        role="img"
        aria-label="Map of anomaly locations. Use the records list for a keyboard-accessible equivalent."
      />
      <div className="anomaly-map-legend" role="group" aria-label="Filter anomalies by detection method">
        {ALL_METHODS.map((method) => {
          const on = activeMethods.has(method);
          const swatch =
            method === 'zscore'
              ? 'anomaly-legend-swatch--zscore'
              : method === 'isolation_forest'
                ? 'anomaly-legend-swatch--iforest'
                : 'anomaly-legend-swatch--both';
          return (
            <button
              key={method}
              type="button"
              className="anomaly-legend-btn"
              aria-pressed={on}
              onClick={() => toggleMethod(method)}
            >
              <span className={`anomaly-legend-swatch ${swatch}`} aria-hidden="true" />
              {METHOD_NAME[method]}
              <span className="anomaly-legend-count">{methodCounts[method]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
