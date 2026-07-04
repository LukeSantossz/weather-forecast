'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import ProvenanceChip from '../ProvenanceChip';
import SectionHeader from '../SectionHeader';
import ShapBar from './ShapBar';
import ShapBeeswarm from './ShapBeeswarm';
import { loadShap, type Shap } from '../../lib/contract';
import styles from './drivers.module.css';

const SHAP_FILE = '/data/shap.json';

type LoadState = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'loaded'; data: Shap };

export interface DriversSectionProps {
  /** Id applied to the section heading; matches page.tsx's `heading-${id}`
   * convention so this can slot into the existing `#drivers` panel. */
  headingId?: string;
}

/**
 * Environmental drivers (SHAP) section (dashboard-phase1.md § Section 3).
 * Loads `shap.json` on mount and renders the loading / error / content
 * states; never a blank screen. Honesty-forward: the title and chip make it
 * explicit this explains the PM2.5 model, not the temperature forecaster.
 */
export default function DriversSection({ headingId = 'heading-drivers' }: DriversSectionProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    loadShap()
      .then((data) => {
        if (!cancelled) setState({ status: 'loaded', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const chip = (
    <ProvenanceChip
      tone="info"
      label="MODEL: PM2.5 · NOT TEMPERATURE"
      title="This SHAP explanation is for the air-quality (PM2.5) model, not the temperature forecast."
    />
  );

  return (
    <div className={styles.driversSection}>
      <SectionHeader title="What drives air-quality (PM2.5) predictions" headingId={headingId} chip={chip} />

      {state.status === 'loading' && (
        <div className={styles.loadingBlock} aria-live="polite" aria-busy="true">
          <Skeleton width={240} height={16} />
          <Skeleton width="100%" height={140} />
          <Skeleton width="100%" height={180} />
        </div>
      )}

      {state.status === 'error' && (
        <Banner
          status="error"
          container="section"
          title="Couldn't load drivers data"
          description={`Failed to fetch ${SHAP_FILE}: ${state.error.message}`}
          endContent={<Button label="Retry" variant="ghost" onClick={retry} />}
        />
      )}

      {state.status === 'loaded' && (
        <div className={styles.driversContent}>
          <ShapBar features={state.data.features} />
          <ShapBeeswarm features={state.data.features} beeswarm={state.data.beeswarm} />
        </div>
      )}
    </div>
  );
}
