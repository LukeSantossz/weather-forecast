'use client';

import './anomalies.css';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { loadAnomalies, DataLoadError } from '../../lib/contract';
import type { Anomalies, AnomalyDetectedBy } from '../../lib/contract';
import MethodStrip from './MethodStrip';
import RecordsList from './RecordsList';
import SemanticSearch from './SemanticSearch';
import MethodologyNote from '../MethodologyNote';
// Type-only: erased at compile time, so casting/typing the dynamic import
// below never pulls the real AnomalyMap module (and its maplibre-gl.css/
// maplibre-gl deps) into this file's own bundle -- only `dynamic()`'s lazy
// `import()` call does that, at runtime, once <AnomalyMap> actually renders.
import type AnomalyMapComponent from './AnomalyMap';
import type { AnomalyMapHandle } from './AnomalyMap';

// The map chunk (and, from inside it, the maplibre-gl module + its CSS) loads
// only when this component renders <AnomalyMap>, which is gated on visibility
// below. ssr:false keeps it out of the static-export prerender entirely. Cast
// to the real forwardRef component type so `ref` type-checks below -- purely
// a compile-time assertion; next/dynamic's own `ComponentType<P>` return type
// has no ref-forwarding annotation, but the lazy-loaded component underneath
// is (and always was) exactly `AnomalyMapComponent`.
const AnomalyMap = dynamic(() => import('./AnomalyMap'), {
  ssr: false,
  loading: () => (
    <div className="anomaly-map-wrap">
      <Skeleton width="100%" height="100%" radius={0} />
    </div>
  ),
}) as unknown as typeof AnomalyMapComponent;

type LoadStatus = 'loading' | 'error' | 'ready';

function MapSkeleton() {
  return (
    <div className="anomaly-map-wrap">
      <Skeleton width="100%" height="100%" radius={0} />
    </div>
  );
}

// The ticker's row count (the approved observatory design preview's
// `.ticker`, "Most extreme flagged readings"). Not a contract field: derived
// client-side from the same `records` array RecordsList already sorts by |z|.
const TICKER_SIZE = 8;

const TICKER_METHOD_LABEL: Record<AnomalyDetectedBy, string> = {
  zscore: 'Z-score',
  isolation_forest: 'Isolation Forest',
  both: 'Both methods',
};

/** Ticker figure tone: hot readings read danger, cold read the cool/info-text
 * tone, everything else stays the primary ink (ported thresholds from the
 * template's ticker: >=25 warm-critical, <=0 cold). */
function tickerTone(temp_c: number): string {
  if (temp_c >= 25) return 'var(--color-danger)';
  if (temp_c <= 0) return 'var(--color-info-text)';
  return 'var(--color-text-primary)';
}

// DESIGN.md § Anomaly explorer: the metric trio, then the map + "most extreme"
// ticker, then the full records list (the map's keyboard-accessible
// equivalent), then semantic search, then the "how to read this" aside. Loads
// the anomalies contract on mount; renders skeleton / inline error / content
// per the state table in dashboard-phase1.md.
export default function AnomaliesSection() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<Anomalies | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Gate the heavy map until the section is actually on screen, so MapLibre
  // only loads on the Anomalies tab even if the panel is merely toggled with
  // `hidden` rather than unmounted.
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Shared with SemanticSearch: selecting a query rings its top matches on
  // the real map via AnomalyMap's imperative `highlightRecords`.
  const mapRef = useRef<AnomalyMapHandle>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    loadAnomalies()
      .then((result) => {
        if (cancelled) return;
        setData(result);
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
  }, [reloadKey]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || hasBeenVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasBeenVisible]);

  const failingFile =
    error instanceof DataLoadError ? `/data/${error.section}.json` : '/data/anomalies.json';

  const ticker = data
    ? [...data.records].sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, TICKER_SIZE)
    : [];

  return (
    <div ref={rootRef} className="anomalies-section">
      {status === 'loading' && (
        <>
          <div className="anomalies-skeleton-strip">
            <Skeleton height={92} index={0} />
            <Skeleton height={92} index={1} />
            <Skeleton height={92} index={2} />
          </div>
          <div className="mapwrap">
            <MapSkeleton />
            <div className="ticker" aria-hidden="true">
              {/* Definite height: `.ticker` has no explicit height in its
                  loading state, so a `height="100%"` skeleton would resolve
                  against an auto (0) basis and collapse. 380px matches the
                  ready-state ticker's own `max-height`. */}
              <Skeleton width="100%" height={380} radius={0} />
            </div>
          </div>
          <div className="records-list-wrap">
            <Skeleton width="100%" height={320} radius={0} />
          </div>
        </>
      )}

      {status === 'error' && (
        <div className="anomalies-error" role="alert">
          <Text as="p" type="body" weight="semibold" color="primary">
            Could not load the anomalies data.
          </Text>
          <Text as="p" type="supporting" color="secondary">
            <span className="anomalies-error-file">{failingFile}</span> failed to load.{' '}
            {error?.message}
          </Text>
          <div className="anomalies-error-actions">
            <Button label="Retry" variant="secondary" onClick={() => setReloadKey((k) => k + 1)} />
          </div>
        </div>
      )}

      {status === 'ready' && data && (
        <>
          <MethodStrip methods={data.methods} />

          <div className="mapwrap">
            {hasBeenVisible ? (
              <AnomalyMap
                ref={mapRef}
                records={data.records}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            ) : (
              <MapSkeleton />
            )}
            {/* role="list"/"listitem" so the aria-label is announced (a
                role-less <div> makes aria-label inert for assistive tech) and
                the "most extreme" readings read as a genuine list. The full
                RecordsList below remains the map's primary text equivalent. */}
            <div className="ticker" role="list" aria-label="Most extreme flagged readings">
              {ticker.map((r, i) => (
                <div className="tkrow" role="listitem" key={`${r.ts}-${r.country}-${i}`}>
                  <div>
                    <div className="cc">{r.country}</div>
                    <div className="cm">
                      {r.ts.slice(0, 10)} · {TICKER_METHOD_LABEL[r.detected_by]}
                    </div>
                  </div>
                  <div>
                    <div className="tt" style={{ color: tickerTone(r.temp_c) }}>
                      {r.temp_c.toFixed(1)}&deg;
                    </div>
                    <div className="tz">z {r.z.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <RecordsList
            records={data.records}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />

          <SemanticSearch mapRef={mapRef} />
        </>
      )}

      <MethodologyNote />
    </div>
  );
}
