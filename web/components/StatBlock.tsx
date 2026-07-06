import type { ReactNode } from 'react';
import { Text } from '@astryxdesign/core/Text';

export interface StatBlockProps {
  /** The headline figure, already formatted (e.g. "0.42", "930", or "-" for pending). */
  value: string;
  /** Unit shown next to the value (e.g. "°C RMSE"); omitted for the pending "-" state. */
  unit?: string;
  label: string;
  /** Usually one or more ProvenanceChip elements. */
  chips?: ReactNode;
  /** Adds the accent left-border that marks the best/emphasized stat. */
  emphasis?: boolean;
}

/** The dash sentinel a caller passes as `value` when a row's metrics are `pending_rerun`. */
const PENDING_VALUE = '-';

// Mono tabular hero/stat-strip number (components/StatBlock.tsx). Value is
// custom (mono, tabular-nums, sized per DESIGN.md's modular-scale top step -
// see .stat-block-value-num in app/theme.css); label reuses Astryx's own
// Text component (body font) rather than reimplementing it.
export default function StatBlock({ value, unit, label, chips, emphasis }: StatBlockProps) {
  const isPending = value === PENDING_VALUE;

  return (
    <div className={emphasis ? 'stat-block stat-block--emphasis' : 'stat-block'}>
      <div className="stat-block-value">
        <span
          className={isPending ? 'stat-block-value-num stat-block-value-num--pending' : 'stat-block-value-num'}
        >
          {value}
        </span>
        {/* A unit next to the pending dash would be misleading, so it's suppressed. */}
        {unit && !isPending && <span className="stat-block-unit">{unit}</span>}
      </div>
      <Text type="label" color="secondary">
        {label}
      </Text>
      {chips && <div className="stat-block-chips">{chips}</div>}
    </div>
  );
}
