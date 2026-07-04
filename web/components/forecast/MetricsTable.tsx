'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { Table } from '@astryxdesign/core/Table';
import { proportional } from '@astryxdesign/core/Table/utils';
import type { TableColumn, TablePlugin } from '@astryxdesign/core/Table';
import type { Metrics, MetricsModel } from '../../lib/contract';
import ProvenanceChip from '../ProvenanceChip';

// Astryx `Table` requires the row type to carry an index signature
// (`T extends Record<string, unknown>`). MetricsModel is the real shape; the
// intersection just satisfies that constraint. The cast is type-only — the
// rendered objects are the untouched contract rows.
type MetricsRow = MetricsModel & Record<string, unknown>;

const PENDING = '—';
const PENDING_TITLE = 'Withdrawn pending evaluation-leakage fix (#20)';

// A numeric metric cell: mono tabular value for `final` rows, a muted dash for
// missing / withdrawn values. Never fabricates a number for a pending row.
function numCell(row: MetricsRow, value: number | null, dp: number): ReactNode {
  if (row.status !== 'final' || value === null || value === undefined) {
    return <span className="metrics-num metrics-num--muted">{PENDING}</span>;
  }
  return <span className="metrics-num">{value.toFixed(dp)}</span>;
}

function statusCell(row: MetricsRow): ReactNode {
  if (row.status === 'final') {
    return <ProvenanceChip tone="final" label="[ FINAL ]" />;
  }
  return <ProvenanceChip tone="pending" label="[ PENDING RE-RUN ]" title={row.note ?? PENDING_TITLE} />;
}

export interface MetricsTableProps {
  metrics: Metrics;
}

export default function MetricsTable({ metrics }: MetricsTableProps) {
  const rows = metrics.models as MetricsRow[];

  // Best final model = lowest RMSE among `final` rows with a real value.
  const finals = metrics.models.filter((m) => m.status === 'final' && m.rmse_c !== null);
  const bestId = finals.length
    ? finals.reduce((a, b) => ((a.rmse_c as number) <= (b.rmse_c as number) ? a : b)).id
    : null;

  const columns: TableColumn<MetricsRow>[] = [
    {
      key: 'name',
      header: 'Model',
      width: proportional(2),
      align: 'start',
      renderCell: (row) => <span className="metrics-model">{row.name}</span>,
    },
    {
      key: 'rmse_c',
      header: 'RMSE (°C)',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => numCell(row, row.rmse_c, 2),
    },
    {
      key: 'mae_c',
      header: 'MAE (°C)',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => numCell(row, row.mae_c, 2),
    },
    {
      key: 'mape_pct',
      header: 'MAPE (%)',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => numCell(row, row.mape_pct, 2),
    },
    {
      key: 'ensemble_weight',
      header: 'Ensemble weight',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => numCell(row, row.ensemble_weight, 2),
    },
    {
      key: 'status',
      header: 'Status',
      width: proportional(1),
      align: 'start',
      renderCell: (row) => statusCell(row),
    },
  ];

  // Marks the best `final` row so theme.css can give it the accent left-border.
  // A data-* attribute is used because it passes through Astryx's row prop
  // merge untouched (unlike className, which the styled row overrides).
  const bestRowPlugin: TablePlugin<MetricsRow> = {
    transformBodyRow: (props, item) => {
      if (item.id !== bestId) return props;
      const htmlProps: HTMLAttributes<HTMLTableRowElement> & { 'data-best-row'?: string } = {
        ...props.htmlProps,
        'data-best-row': 'true',
      };
      return { ...props, htmlProps };
    },
  };

  return (
    <div className="metrics-table-wrap">
      <Table<MetricsRow>
        data={rows}
        columns={columns}
        idKey="id"
        dividers="rows"
        density="balanced"
        plugins={{ bestRow: bestRowPlugin }}
      />
    </div>
  );
}
