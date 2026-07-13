'use client';

// MapLibre's own stylesheet (popups, controls, canvas positioning). This sits
// in AnomalyMap's chunk, which AnomaliesSection loads via next/dynamic
// (ssr:false) only once the section is visible, so it is never in the main
// bundle or the prerendered HTML. The heavy maplibre-gl *module* is loaded
// separately with a dynamic import() in the mount effect below.
import 'maplibre-gl/dist/maplibre-gl.css';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  /** A click on empty map (not on a marker) reports its lat/lon, so the live
   * checker can drop its synthetic observation there. */
  onMapClick?: (lat: number, lon: number) => void;
}

// Which method(s) flagged the synthetic checker reading, driving its marker
// shape the same way `detected_by` drives the real markers.
export type SyntheticMethod = 'zscore' | 'isolation_forest' | 'both' | 'none';

// Imperative cross-link for the semantic-search panel (SemanticSearch.tsx):
// selecting a query ranks records offline, then rings the top matches on this
// real map via a dedicated `sem-highlights` source, without the map needing to
// know anything about embeddings/search. The checker (AnomalyChecker.tsx) drives
// `placeSyntheticPoint`/`clearSyntheticPoint` the same way.
export interface AnomalyMapHandle {
  highlightRecords(records: { lat: number; lon: number }[]): void;
  placeSyntheticPoint(lat: number, lon: number, tempC: number, method: SyntheticMethod): void;
  clearSyntheticPoint(): void;
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

// Diverging temperature scale (DESIGN.md § Dataviz palette: "the one scale
// every chart and map reuses"), ported verbatim from the Observatory preview
// template's tempColor helper: cool -> neutral -> warm. Fixed light/dark
// endpoints plus one neutral midpoint, not a themed token -- same convention
// already locked for this exact scale in Hero.tsx's warming stripes.
const TEMP_COOL_LIGHT = '#2e8aa8';
const TEMP_COOL_DARK = '#3fa9c7';
const TEMP_NEUTRAL_MID = '#c9c3b6';
const TEMP_WARM_LIGHT = '#d8511c';
const TEMP_WARM_DARK = '#f2612c';

// The semantic-search cross-link: a dedicated GeoJSON source + a pulsing
// "ember ring" circle layer (plus a small solid center dot), driven by
// `highlightRecords` below. Kept separate from the `anomalies` source/layers
// above so search highlighting never interferes with the marker filter/select
// state machine.
const SRC_SEM = 'sem-highlights';
const LAYER_SEM_RING = 'sem-highlight-ring';
const LAYER_SEM_DOT = 'sem-highlight-dot';
const SEM_RING_MIN_RADIUS = 8;
const SEM_RING_MAX_RADIUS = 15;
const SEM_RING_STATIC_RADIUS = 12;
const SEM_PULSE_DURATION_MS = 1800;

// The live checker's synthetic observation: a dedicated source with a
// temperature-coloured dot (shaped by the flagging method, like the real
// markers) plus an accent outer ring marking it as the visitor's placed point.
const SRC_SYNTH = 'synthetic-point';
const LAYER_SYNTH_RING = 'synthetic-point-ring';
const LAYER_SYNTH_DOT = 'synthetic-point-dot';

interface SyntheticPoint {
  lat: number;
  lon: number;
  tempC: number;
  method: SyntheticMethod;
}

/** Builds the `sem-highlights` source data; `rank` (1-based) is the only
 * property the ring/dot layers need, matching the brief's handle contract. */
function toSemFeatureCollection(records: { lat: number; lon: number }[]) {
  return {
    type: 'FeatureCollection' as const,
    features: records.map((r, i) => ({
      type: 'Feature' as const,
      properties: { rank: i + 1 },
      geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
    })),
  };
}

/** Builds the `synthetic-point` source data: one feature carrying `temp_c`
 * (for the colour scale) and `method` (for the shape), or empty when cleared. */
function toSynthFeatureCollection(point: SyntheticPoint | null) {
  return {
    type: 'FeatureCollection' as const,
    features: point
      ? [
          {
            type: 'Feature' as const,
            properties: { temp_c: point.tempC, method: point.method },
            geometry: { type: 'Point' as const, coordinates: [point.lon, point.lat] },
          },
        ]
      : [],
  };
}

// Diverging temperature scale (DESIGN.md § Dataviz palette): the maplibre
// interpolate expression mapping `temp_c` to cool -> neutral -> warm, scaled to
// this record set's real min/max (nudged apart when every record shares one
// temperature so the stops stay strictly increasing). Shared by the anomaly
// markers and the synthetic checker point so both read on the same scale.
function buildTempColorExpr(records: AnomalyRecord[], theme: 'light' | 'dark'): unknown[] {
  const temps = records.map((r) => r.temp_c);
  let minTemp = temps.length ? Math.min(...temps) : 0;
  let maxTemp = temps.length ? Math.max(...temps) : 1;
  if (minTemp === maxTemp) {
    minTemp -= 0.5;
    maxTemp += 0.5;
  }
  const midTemp = (minTemp + maxTemp) / 2;
  const coolHex = theme === 'light' ? TEMP_COOL_LIGHT : TEMP_COOL_DARK;
  const warmHex = theme === 'light' ? TEMP_WARM_LIGHT : TEMP_WARM_DARK;
  return [
    'interpolate',
    ['linear'],
    ['get', 'temp_c'],
    minTemp,
    coolHex,
    midTemp,
    TEMP_NEUTRAL_MID,
    maxTemp,
    warmHex,
  ];
}

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
// choropleth), coloured by temperature via the diverging scale and shaped by
// detection method, sized by |z|, hover tooltip, legend filter, and no fly-to
// under reduced motion. The records list is the keyboard-accessible
// equivalent. Wrapped in forwardRef so AnomaliesSection can drive
// `highlightRecords` (the semantic-search cross-link) from a shared ref.
const AnomalyMap = forwardRef<AnomalyMapHandle, AnomalyMapProps>(function AnomalyMap(
  { records, selectedIndex, onSelect, onMapClick },
  ref,
) {
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
  // Latest semantic-search highlight request (survives across theme-driven
  // source/layer rebuilds and across a `highlightRecords` call that arrives
  // before the map has finished loading -- see the `load`/`styledata`
  // handlers below, which re-seed the source from this ref).
  const semHighlightsRef = useRef(toSemFeatureCollection([]));
  const pulseFrameRef = useRef<number | null>(null);
  const pulseStartRef = useRef(0);
  // Latest synthetic checker point (survives theme-driven source/layer rebuilds
  // and a place call arriving before the map finished loading).
  const synthPointRef = useRef<SyntheticPoint | null>(null);
  const onMapClickRef = useRef(onMapClick);
  // Imperative API published by the mount effect, so the prop-driven effects
  // below can drive the map without re-running setup.
  const apiRef = useRef<{
    applyFilter: () => void;
    applySelection: () => void;
    updateSemPulse: () => void;
  } | null>(null);

  recordsRef.current = records;
  onSelectRef.current = onSelect;
  selectedRef.current = selectedIndex;
  onMapClickRef.current = onMapClick;

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
        const currentRecords = recordsRef.current;
        const data = toFeatureCollection(currentRecords);
        const existing = map.getSource(SRC) as GeoJSONSource | undefined;
        if (existing) {
          existing.setData(data);
        } else {
          map.addSource(SRC, { type: 'geojson', data });
        }

        const accent = resolveColor('var(--color-accent)');
        const ring = resolveColor('var(--color-background-surface)');

        // Diverging temperature scale (DESIGN.md § Dataviz palette), scaled to
        // this record set's real min/max. Shared with the synthetic checker
        // point via buildTempColorExpr so both read on the same scale.
        const tempColorExpr = buildTempColorExpr(currentRecords, currentTheme());
        // DESIGN.md § Dataviz palette: "anomaly methods: encoded by marker
        // shape, not hue" -- a filled dot is z-score/both, an open ring
        // (transparent fill, temperature-coloured stroke) is isolation-forest.
        // The both-methods overlap is called out as a stat (MethodStrip), not
        // a third map hue/shape.
        const isIsolationForest = ['==', ['get', 'detected_by'], 'isolation_forest'];

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
              'circle-color': ['case', isIsolationForest, 'transparent', tempColorExpr],
              'circle-radius': ['interpolate', ['linear'], ['abs', ['get', 'z']], 3, 5, 4.6, 13],
              'circle-opacity': 0.85,
              'circle-stroke-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                3,
                isIsolationForest,
                2,
                1,
              ],
              'circle-stroke-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                accent,
                isIsolationForest,
                tempColorExpr,
                ring,
              ],
            },
          } as unknown as LayerSpecification);
        }
      };

      // The semantic-search cross-link: a pulsing ember ring + a small solid
      // center dot, bound to the dedicated `sem-highlights` source. Re-added
      // (with freshly resolved colours) alongside the anomaly layers on
      // `load` and after every theme-driven `setStyle` below.
      const addSemHighlightLayer = () => {
        const existingSem = map.getSource(SRC_SEM) as GeoJSONSource | undefined;
        if (existingSem) {
          existingSem.setData(semHighlightsRef.current);
        } else {
          map.addSource(SRC_SEM, { type: 'geojson', data: semHighlightsRef.current });
        }

        const emberAccent = resolveColor('var(--color-accent)');

        if (!map.getLayer(LAYER_SEM_RING)) {
          map.addLayer({
            id: LAYER_SEM_RING,
            type: 'circle',
            source: SRC_SEM,
            paint: {
              'circle-radius': SEM_RING_MIN_RADIUS,
              'circle-color': 'transparent',
              'circle-stroke-color': emberAccent,
              'circle-stroke-width': 2,
              'circle-stroke-opacity': 0.9,
            },
          } as unknown as LayerSpecification);
        }
        if (!map.getLayer(LAYER_SEM_DOT)) {
          map.addLayer({
            id: LAYER_SEM_DOT,
            type: 'circle',
            source: SRC_SEM,
            paint: { 'circle-radius': 3, 'circle-color': emberAccent },
          } as unknown as LayerSpecification);
        }
      };

      // The live checker's synthetic point: a temperature-coloured dot shaped by
      // the flagging method (open ring for isolation-forest, filled otherwise,
      // matching the real markers) under an accent ring that marks it as the
      // visitor's placed reading. Re-added with fresh colours on `load` and after
      // each theme-driven `setStyle`, like the anomaly and semantic layers.
      const addSyntheticLayer = () => {
        const existingSynth = map.getSource(SRC_SYNTH) as GeoJSONSource | undefined;
        if (existingSynth) {
          existingSynth.setData(toSynthFeatureCollection(synthPointRef.current));
        } else {
          map.addSource(SRC_SYNTH, {
            type: 'geojson',
            data: toSynthFeatureCollection(synthPointRef.current),
          });
        }

        const accent = resolveColor('var(--color-accent)');
        const ring = resolveColor('var(--color-background-surface)');
        const tempColor = buildTempColorExpr(recordsRef.current, currentTheme());
        const isIsolationForest = ['==', ['get', 'method'], 'isolation_forest'];

        if (!map.getLayer(LAYER_SYNTH_RING)) {
          map.addLayer({
            id: LAYER_SYNTH_RING,
            type: 'circle',
            source: SRC_SYNTH,
            paint: {
              'circle-radius': 13,
              'circle-color': 'transparent',
              'circle-stroke-color': accent,
              'circle-stroke-width': 2,
              'circle-stroke-opacity': 0.9,
            },
          } as unknown as LayerSpecification);
        }
        if (!map.getLayer(LAYER_SYNTH_DOT)) {
          map.addLayer({
            id: LAYER_SYNTH_DOT,
            type: 'circle',
            source: SRC_SYNTH,
            paint: {
              'circle-radius': 7,
              'circle-color': ['case', isIsolationForest, 'transparent', tempColor],
              'circle-opacity': 0.9,
              'circle-stroke-width': ['case', isIsolationForest, 2, 1],
              'circle-stroke-color': ['case', isIsolationForest, tempColor, ring],
            },
          } as unknown as LayerSpecification);
        }
      };

      // rAF-driven pulse (maplibre has no built-in paint-property animation):
      // grows/shrinks the ring's radius and stroke-opacity on a sine wave.
      // Static under reduced motion (DESIGN.md § Accessibility) and stopped
      // entirely once there is nothing to highlight.
      const stopSemPulse = () => {
        if (pulseFrameRef.current !== null) {
          cancelAnimationFrame(pulseFrameRef.current);
          pulseFrameRef.current = null;
        }
      };

      const setStaticSemRing = () => {
        if (!map.getLayer(LAYER_SEM_RING)) return;
        map.setPaintProperty(LAYER_SEM_RING, 'circle-radius', SEM_RING_STATIC_RADIUS);
        map.setPaintProperty(LAYER_SEM_RING, 'circle-stroke-opacity', 0.9);
      };

      const tickSemPulse = (now: number) => {
        if (!map.getLayer(LAYER_SEM_RING)) {
          pulseFrameRef.current = null;
          return;
        }
        if (!pulseStartRef.current) pulseStartRef.current = now;
        const phase = ((now - pulseStartRef.current) % SEM_PULSE_DURATION_MS) / SEM_PULSE_DURATION_MS;
        const wave = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
        map.setPaintProperty(
          LAYER_SEM_RING,
          'circle-radius',
          SEM_RING_MIN_RADIUS + wave * (SEM_RING_MAX_RADIUS - SEM_RING_MIN_RADIUS),
        );
        map.setPaintProperty(LAYER_SEM_RING, 'circle-stroke-opacity', 0.9 - wave * 0.55);
        pulseFrameRef.current = requestAnimationFrame(tickSemPulse);
      };

      const updateSemPulse = () => {
        if (semHighlightsRef.current.features.length === 0) {
          stopSemPulse();
          return;
        }
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
          stopSemPulse();
          setStaticSemRing();
          return;
        }
        if (pulseFrameRef.current === null) {
          pulseStartRef.current = 0;
          pulseFrameRef.current = requestAnimationFrame(tickSemPulse);
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

      apiRef.current = { applyFilter, applySelection, updateSemPulse };

      map.on('load', () => {
        addAnomalyLayers();
        addSemHighlightLayer();
        addSyntheticLayer();
        const recs = recordsRef.current;
        if (recs.length > 0) {
          const bounds = new maplibre.LngLatBounds();
          recs.forEach((r) => bounds.extend([r.lon, r.lat]));
          map.fitBounds(bounds, { padding: 48, maxZoom: 4.5, animate: false });
        }
        readyRef.current = true;
        applyFilter();
        applySelection();
        updateSemPulse();
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

      // A click on empty map (not on a marker) reports its location so the
      // checker can drop its synthetic observation there. Hit-test the marker
      // layer so a marker click only selects and never also places a point.
      map.on('click', (e) => {
        if (!readyRef.current || !map.getLayer(LAYER_HIT)) return;
        const onMarker = map.queryRenderedFeatures(e.point, { layers: [LAYER_HIT] });
        if (onMarker.length > 0) return;
        onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
      });

      // Re-theme the base map when the console theme toggles; re-add our
      // source/layers (setStyle clears them) with freshly resolved colours.
      themeObserver = new MutationObserver(() => {
        map.setStyle(styleUrl(currentTheme()));
        map.once('styledata', () => {
          addAnomalyLayers();
          addSemHighlightLayer();
          addSyntheticLayer();
          applyFilter();
          applySelection();
          updateSemPulse();
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
      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
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

  // The semantic-search cross-link: SemanticSearch calls this on every
  // active-query change. Always records the latest request in
  // `semHighlightsRef` (so a call arriving before the map has loaded is
  // applied once `addSemHighlightLayer` seeds the source), then pushes it
  // straight to the live source + pulse state when the map is ready.
  useImperativeHandle(
    ref,
    () => ({
      highlightRecords(newRecords) {
        const fc = toSemFeatureCollection(newRecords);
        semHighlightsRef.current = fc;
        if (!readyRef.current) return;
        const source = mapRef.current?.getSource(SRC_SEM) as GeoJSONSource | undefined;
        source?.setData(fc);
        apiRef.current?.updateSemPulse();
      },
      placeSyntheticPoint(lat, lon, tempC, method) {
        synthPointRef.current = { lat, lon, tempC, method };
        if (!readyRef.current) return;
        const source = mapRef.current?.getSource(SRC_SYNTH) as GeoJSONSource | undefined;
        source?.setData(toSynthFeatureCollection(synthPointRef.current));
      },
      clearSyntheticPoint() {
        synthPointRef.current = null;
        if (!readyRef.current) return;
        const source = mapRef.current?.getSource(SRC_SYNTH) as GeoJSONSource | undefined;
        source?.setData(toSynthFeatureCollection(null));
      },
    }),
    [],
  );

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
});

AnomalyMap.displayName = 'AnomalyMap';

export default AnomalyMap;
