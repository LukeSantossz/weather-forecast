'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { DataLoadError, loadForecast, loadMetrics } from '../../lib/contract';
import type { Forecast, Metrics, SectionName } from '../../lib/contract';
import StatBlock from '../StatBlock';
import ProvenanceChip from '../ProvenanceChip';
import ForecastChart from './ForecastChart';
import MetricsTable from './MetricsTable';

type SectionState =
  | { phase: 'loading' }
  | { phase: 'error'; section: SectionName; message: string }
  | { phase: 'ready'; forecast: Forecast; metrics: Metrics };

export default function ForecastSection() {
  const [state, setState] = useState<SectionState>({ phase: 'loading' });

  useEffect(() => {
    let alive = true;
    Promise.all([loadForecast(), loadMetrics()])
      .then(([forecast, metrics]) => {
        if (alive) setState({ phase: 'ready', forecast, metrics });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const section: SectionName = err instanceof DataLoadError ? err.section : 'forecast';
        const message = err instanceof Error ? err.message : 'Unknown error loading forecast data.';
        setState({ phase: 'error', section, message });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.phase === 'loading') {
    // Skeletons sized to the real content (hero, chart, table) to avoid layout
    // shift on resolve (DESIGN.md state table: initial load).
    return (
      <div className="forecast-loading" aria-busy="true">
        <Skeleton width={280} height={72} />
        <Skeleton width="100%" height={360} index={1} />
        <Skeleton width="100%" height={220} index={2} />
      </div>
    );
  }

  if (state.phase === 'error') {
    // Never a blank screen: name the failing file and keep the rest usable.
    return (
      <div className="forecast-error" role="alert">
        <div className="forecast-error-title">Could not load forecast</div>
        <p>
          The <code>{state.section}.json</code> data could not be loaded. Other sections may still work.
        </p>
        <p className="forecast-error-detail">{state.message}</p>
      </div>
    );
  }

  const { forecast, metrics } = state;

  // Hero shows the best available honest number: the lowest-RMSE `final` model.
  const finals = metrics.models.filter((m) => m.status === 'final' && m.rmse_c !== null);
  const best = finals.length
    ? finals.reduce((a, b) => ((a.rmse_c as number) <= (b.rmse_c as number) ? a : b))
    : null;
  const heroValue = best && best.rmse_c !== null ? best.rmse_c.toFixed(2) : '-';
  const heroLabel = best
    ? `${best.name} · daily-mean temperature across 211 countries`
    : 'Daily-mean temperature across 211 countries';

  return (
    <div className="forecast-section">
      <div className="forecast-hero">
        <StatBlock
          value={heroValue}
          unit="°C RMSE"
          label={heroLabel}
          emphasis
          chips={
            <>
              <ProvenanceChip tone="holdout" label="[ HOLDOUT ]" />
              <ProvenanceChip tone="holdout" label="[ GLOBAL DAILY MEAN ]" />
            </>
          }
        />
      </div>

      <ForecastChart series={forecast.series} />
      <MetricsTable metrics={metrics} />
    </div>
  );
}
