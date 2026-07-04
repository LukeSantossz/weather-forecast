'use client';

import './anomalies.css';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { loadAnomalies, DataLoadError } from '../../lib/contract';
import type { Anomalies } from '../../lib/contract';
import MethodStrip from './MethodStrip';
import RecordsList from './RecordsList';

// The map chunk (and, from inside it, the maplibre-gl module + its CSS) loads
// only when this component renders <AnomalyMap>, which is gated on visibility
// below. ssr:false keeps it out of the static-export prerender entirely.
const AnomalyMap = dynamic(() => import('./AnomalyMap'), {
  ssr: false,
  loading: () => (
    <div className="anomaly-map-wrap">
      <Skeleton width="100%" height="100%" radius={0} />
    </div>
  ),
});

type LoadStatus = 'loading' | 'error' | 'ready';

function MapSkeleton() {
  return (
    <div className="anomaly-map-wrap">
      <Skeleton width="100%" height="100%" radius={0} />
    </div>
  );
}

// DESIGN.md § Anomaly explorer: a method stat-strip, then the map (dominant)
// with the records list beside it on wide screens / below on mobile. Loads the
// anomalies contract on mount; renders skeleton / inline error / content per
// the state table in dashboard-phase1.md.
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

  return (
    <div ref={rootRef} className="anomalies-section">
      {status === 'loading' && (
        <>
          <div className="anomalies-skeleton-strip">
            <Skeleton height={92} index={0} />
            <Skeleton height={92} index={1} />
            <Skeleton height={92} index={2} />
          </div>
          <div className="anomalies-explorer">
            <MapSkeleton />
            <div className="records-list-wrap">
              <Skeleton width="100%" height={320} radius={0} />
            </div>
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
          <div className="anomalies-explorer">
            {hasBeenVisible ? (
              <AnomalyMap
                records={data.records}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
              />
            ) : (
              <MapSkeleton />
            )}
            <RecordsList
              records={data.records}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
          </div>
        </>
      )}
    </div>
  );
}
