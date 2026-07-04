import { List, ListItem } from '@astryxdesign/core/List';
import { Text } from '@astryxdesign/core/Text';
import type { AnomalyRecord, AnomalyDetectedBy } from '../../lib/contract';

export interface RecordsListProps {
  records: AnomalyRecord[];
  /** Index into `records` of the highlighted record, or null. */
  selectedIndex: number | null;
  /** Selecting a row pans + highlights its map marker (and vice-versa). */
  onSelect: (index: number | null) => void;
}

/** Short, non-colour-only method tag shown on each row. */
const METHOD_LABEL: Record<AnomalyDetectedBy, string> = {
  zscore: 'Z',
  isolation_forest: 'IF',
  both: 'BOTH',
};

const METHOD_DOT_CLASS: Record<AnomalyDetectedBy, string> = {
  zscore: 'records-method-dot--zscore',
  isolation_forest: 'records-method-dot--iforest',
  both: 'records-method-dot--both',
};

function MethodTag({ detectedBy }: { detectedBy: AnomalyDetectedBy }) {
  return (
    <span className="records-method">
      <span className={`records-method-dot ${METHOD_DOT_CLASS[detectedBy]}`} aria-hidden="true" />
      {METHOD_LABEL[detectedBy]}
    </span>
  );
}

// DESIGN.md § Anomaly explorer: "the records side-panel is the map's accessible
// equivalent." Astryx List/ListItem (from the manifest) give keyboard-reachable
// rows for free (onClick -> the invisible-button pattern). Rows are ordered by
// severity (|z| desc) so the strongest anomalies read first; numbers wear mono.
export default function RecordsList({ records, selectedIndex, onSelect }: RecordsListProps) {
  const ordered = records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => Math.abs(b.record.z) - Math.abs(a.record.z));

  return (
    <div className="records-list-wrap">
      <List
        density="compact"
        hasDividers
        header={
          <Text type="label" color="secondary">
            Top anomalies · {records.length} records
          </Text>
        }
      >
        {ordered.map(({ record, index }) => {
          const date = record.ts.slice(0, 10);
          const description = (
            <span className="records-desc">
              {date} · {record.temp_c.toFixed(1)}°C · z {record.z.toFixed(2)} · if{' '}
              {record.if_score.toFixed(2)}
            </span>
          );

          return (
            <ListItem
              key={index}
              label={record.country}
              description={description}
              endContent={<MethodTag detectedBy={record.detected_by} />}
              isSelected={selectedIndex === index}
              onClick={() => onSelect(index)}
            />
          );
        })}
      </List>
    </div>
  );
}
