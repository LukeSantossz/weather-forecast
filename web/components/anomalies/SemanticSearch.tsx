'use client';

import { useEffect, useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { loadAnomalyEmbeddings } from '../../lib/contract';
import type { AnomalyEmbeddings, EmbeddedAnomalyRecord } from '../../lib/contract';

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

// DESIGN: a keyless, offline semantic-search demo over the precomputed anomaly
// embeddings (issue #32). Selecting an example query ranks records by cosine
// similarity in the browser -- no model, no network beyond the static JSON.
export default function SemanticSearch() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [data, setData] = useState<AnomalyEmbeddings | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [activeQuery, setActiveQuery] = useState(0);

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

  const query = data.queries[activeQuery];
  const matches = topMatches(query.embedding, data.records, TOP_K);

  return (
    <div className="semantic-search">
      <div className="semantic-search-header">
        <Text as="h3" type="large" weight="semibold" color="primary">
          Semantic search
        </Text>
        <Text as="p" type="supporting" color="secondary">
          Pick an example query to rank anomalies by meaning. Embeddings are precomputed
          ({data.model}); similarity runs offline in your browser.
        </Text>
      </div>

      <div className="semantic-search-chips" role="group" aria-label="Example queries">
        {data.queries.map((candidate, index) => (
          <Button
            key={candidate.text}
            label={candidate.text}
            variant={index === activeQuery ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveQuery(index)}
          />
        ))}
      </div>

      <ol className="semantic-search-results">
        {matches.map(({ record, score }, rank) => (
          <li key={`${record.ts}-${record.country}-${rank}`} className="semantic-search-result">
            <span className="semantic-search-rank" aria-hidden="true">
              {rank + 1}
            </span>
            <span className="semantic-search-country">{record.country}</span>
            <span className="semantic-search-detail">
              {record.temp_c}&deg;C &middot; z {record.z.toFixed(2)} &middot; {record.detected_by}
            </span>
            <span className="semantic-search-score">{score.toFixed(3)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
