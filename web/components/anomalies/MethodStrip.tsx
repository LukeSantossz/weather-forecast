import StatBlock from '../StatBlock';
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

// DESIGN.md § Anomaly explorer: a method stat-strip of three StatBlocks. The
// counts/shares come straight from the contract's `methods` block (not derived).
// Each item takes its map-legend colour as a left accent (see anomalies.css);
// Overlap uses the danger tone because both methods agreeing is the strongest
// signal. Values wear mono via StatBlock; the method name is the plain label.
export default function MethodStrip({ methods }: MethodStripProps) {
  return (
    <div className="anomalies-method-strip">
      <div className="method-strip-item method-strip-item--zscore">
        <StatBlock
          value={String(methods.zscore.count)}
          unit={`· ${formatShare(methods.zscore.share_pct)}`}
          label="Z-score anomalies"
          chips={
            <ProvenanceChip
              tone="info"
              label={`[ |Z| ≥ ${methods.zscore.threshold.toFixed(1)} ]`}
              title="Flagged when the standardized daily anomaly exceeds the z-score threshold."
            />
          }
        />
      </div>

      <div className="method-strip-item method-strip-item--iforest">
        <StatBlock
          value={String(methods.isolation_forest.count)}
          unit={`· ${formatShare(methods.isolation_forest.share_pct)}`}
          label="Isolation Forest anomalies"
          chips={
            <ProvenanceChip
              tone="holdout"
              label={`[ CONTAM ${methods.isolation_forest.contamination} ]`}
              title="Isolation Forest contamination rate (expected share of anomalies)."
            />
          }
        />
      </div>

      <div className="method-strip-item method-strip-item--overlap">
        <StatBlock
          value={String(methods.overlap_count)}
          label="Overlap · both methods agree"
          chips={
            <ProvenanceChip
              tone="danger"
              label="[ BOTH METHODS ]"
              title="Records flagged by z-score and Isolation Forest together."
            />
          }
        />
      </div>
    </div>
  );
}
