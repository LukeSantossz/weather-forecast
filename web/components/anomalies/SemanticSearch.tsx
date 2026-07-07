'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { loadAnomalyEmbeddings } from '../../lib/contract';
import type { AnomalyEmbeddings, AnomalyDetectedBy, EmbeddedAnomalyRecord } from '../../lib/contract';
import type { AnomalyMapHandle } from './AnomalyMap';

type LoadStatus = 'loading' | 'error' | 'ready';

const TOP_K = 5;

interface Ranked {
  record: EmbeddedAnomalyRecord;
  score: number;
}

// Record and query embeddings are L2-normalized (sentence-transformers
// `normalize_embeddings=True`), so the dot product is the cosine similarity.
// This mirrors the tested Python `cosine_top_k`.
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function topMatches(
  queryEmbedding: number[],
  records: EmbeddedAnomalyRecord[],
  k: number,
): Ranked[] {
  return records
    .map((record) => ({ record, score: dot(queryEmbedding, record.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Short method label for the `.semd` detail line (matches AnomalyMap's own
// binary-shape convention: "both" reads the same as z-score everywhere except
// the MethodStrip overlap stat -- DESIGN.md § Dataviz palette).
const METHOD_LABEL: Record<AnomalyDetectedBy, string> = {
  zscore: 'z-score',
  isolation_forest: 'isolation forest',
  both: 'both methods',
};

export interface SemanticSearchProps {
  /** The Anomalies act's shared AnomalyMap ref (AnomaliesSection owns it):
   * ranking a query calls `highlightRecords` so the top matches ring on the
   * real map. `null` until the map has mounted (it is gated on visibility),
   * in which case the call below is simply a no-op. */
  mapRef: RefObject<AnomalyMapHandle | null>;
}

// DESIGN: a keyless, offline semantic-search demo over the precomputed anomaly
// embeddings (issue #32). Selecting an example query ranks records by cosine
// similarity in the browser -- no model, no network beyond the static JSON
// already loaded via loadAnomalyEmbeddings. Restyled to the Observatory
// `.semchip`/`.semrow`/`.semscorebar` (docs/design/
// observatory-preview-template.html); the ranking algorithm above is
// unchanged.
export default function SemanticSearch({ mapRef }: SemanticSearchProps) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<AnomalyEmbeddings | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [activeQuery, setActiveQuery] = useState(0);
  // Drives the score-bar grow-in (ported from the template's double-rAF ->
  // CSS `width` transition). Starts collapsed on every query change so the
  // bars visibly re-animate, same as the template's `render()`.
  const [revealed, setRevealed] = useState(false);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAnomalyEmbeddings()
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
  }, []);

  const query = data ? data.queries[activeQuery] : null;
  const matches = data && query ? topMatches(query.embedding, data.records, TOP_K) : [];

  // Cross-link: ring the current top matches on the real map, and re-animate
  // the score bars, every time the active query (or the loaded data) changes.
  // A no-op via optional chaining while the map hasn't mounted yet (it is
  // gated on section visibility in AnomaliesSection).
  useEffect(() => {
    if (!data) return;
    mapRef.current?.highlightRecords(matches.map((m) => m.record));

    if (reduceMotionRef.current) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealed(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matches` is a
    // pure function of activeQuery/data, both listed below.
  }, [activeQuery, data]);

  if (status === 'loading') {
    return (
      <div className="semantic-search">
        <Skeleton width="100%" height={180} radius={0} />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className="semantic-search">
        <Text as="p" type="supporting" color="secondary">
          Semantic search is unavailable: {error?.message}
        </Text>
      </div>
    );
  }

  const maxScore = matches.length ? matches[0].score : 0;
  const minScore = matches.length ? matches[matches.length - 1].score : 0;

  return (
    <div className="semantic-search">
      <div className="semantic-search-header">
        <Text as="h3" type="large" weight="semibold" color="primary">
          Search anomalies by meaning
        </Text>
        <span className="semantic-search-model">
          {data.model} · {data.dim}-d · cosine, in-browser
        </span>
      </div>

      <div className="sembody">
        <p className="semhint">
          Pick a phrase. The page ranks flagged readings by embedding similarity, with no server
          call and no API key. The top matches ring on the map above.
        </p>

        <div className="semchips" role="group" aria-label="Example queries">
          {data.queries.map((candidate, index) => (
            <button
              key={candidate.text}
              type="button"
              className={`semchip${index === activeQuery ? ' on' : ''}`}
              aria-pressed={index === activeQuery}
              onClick={() => setActiveQuery(index)}
            >
              {candidate.text}
            </button>
          ))}
        </div>

        <ol className="semresults">
          {matches.map(({ record, score }, rank) => {
            const w = maxScore > minScore ? (score - minScore) / (maxScore - minScore) : 1;
            const widthPct = Math.max(8, 20 + w * 80);
            return (
              <li key={`${record.ts}-${record.country}-${rank}`} className="semrow">
                <span className="semrank" aria-hidden="true">
                  {rank + 1}
                </span>
                <div>
                  <div className="semc">{record.country}</div>
                  <div className="semd">
                    {record.temp_c.toFixed(1)}&deg;C &middot; z {record.z.toFixed(2)} &middot;{' '}
                    {METHOD_LABEL[record.detected_by]} &middot; {record.ts.slice(0, 10)}
                  </div>
                </div>
                <div className="semscorewrap">
                  <div
                    className="semscorebar"
                    style={{
                      width: revealed ? `${widthPct}%` : '0%',
                      transitionDelay: reduceMotionRef.current ? '0ms' : `${rank * 50}ms`,
                    }}
                  />
                </div>
                <span className="semscore">{score.toFixed(3)}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
