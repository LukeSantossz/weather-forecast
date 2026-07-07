import ProvenanceChip from '../ProvenanceChip';
import type { AnomalyMethods } from '../../lib/contract';

export interface MethodStripProps {
  /** The `methods` block of the anomalies contract (counts, shares, params). */
  methods: AnomalyMethods;
}

/** Two-decimal percent, mono-friendly (e.g. 0.7 -> "0.70%"). */
function formatShare(share_pct: number): string {
  return `${share_pct.toFixed(2)}%`;
}

// DESIGN.md § Anomaly explorer: the metric trio, ported from the Observatory
// preview template's `.metricstrip`/`.mcard` (docs/design/
// observatory-preview-template.html). The counts/shares come straight from the
// contract's `methods` block (not derived); "both" is the accented hero card
// since the overlap is the highest-confidence signal. Every card still wears
// its ProvenanceChip (DESIGN.md § Signature: "every claim/number that has
// provenance still wears one") inside `.ms`, alongside the template's plain
// descriptive line.
export default function MethodStrip({ methods }: MethodStripProps) {
  return (
    <div className="metricstrip">
      <div className="mcard">
        <div className="mv">{methods.zscore.count}</div>
        <div className="mk">Z-score anomalies</div>
        <div className="ms">
          <ProvenanceChip
            tone="info"
            label={`[ |Z| ≥ ${methods.zscore.threshold.toFixed(1)} ]`}
            title="Flagged when the standardized daily anomaly exceeds the z-score threshold."
          />
          <span>{formatShare(methods.zscore.share_pct)} of readings</span>
        </div>
      </div>

      <div className="mcard">
        <div className="mv">{methods.isolation_forest.count}</div>
        <div className="mk">Isolation Forest anomalies</div>
        <div className="ms">
          <ProvenanceChip
            tone="holdout"
            label={`[ CONTAM ${methods.isolation_forest.contamination} ]`}
            title="Isolation Forest contamination rate (expected share of anomalies)."
          />
          <span>{formatShare(methods.isolation_forest.share_pct)} of readings</span>
        </div>
      </div>

      <div className="mcard hero-card">
        <div className="mv">{methods.overlap_count}</div>
        <div className="mk">Overlap · both methods agree</div>
        <div className="ms">
          <ProvenanceChip
            tone="danger"
            label="[ BOTH METHODS ]"
            title="Records flagged by z-score and Isolation Forest together."
          />
          <span>The highest-confidence outliers</span>
        </div>
      </div>
    </div>
  );
}
