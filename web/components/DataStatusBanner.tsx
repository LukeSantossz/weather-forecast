import meta from '../public/data/meta.json';

// Mirrors the enum in web/public/data/schema/meta.schema.json (data_status).
// Kept local (not a shared contract module) until web/lib/contract.ts lands
// in a later task.
type Meta = {
  generated_at: string;
  data_status: 'sample' | 'real';
  pipeline: {
    source: string;
    repo_commit?: string | null;
  };
};

function shortDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toISOString().slice(0, 10);
}

function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : 'unknown';
}

// Full-width, first-class honesty banner (DESIGN.md § Signature: provenance
// chips). Never hidden: renders a distinct line for both `sample` and `real`
// data_status values from the committed meta.json contract.
export default function DataStatusBanner() {
  const data = meta as Meta;

  if (data.data_status === 'sample') {
    return (
      <div className="data-status-banner" role="status" style={{ color: 'var(--color-warning)' }}>
        [ SAMPLE DATA ] layout preview · not model output
      </div>
    );
  }

  return (
    <div className="data-status-banner" role="status" style={{ color: 'var(--color-text-secondary)' }}>
      [ REAL ] generated {shortDate(data.generated_at)} · commit {shortSha(data.pipeline.repo_commit)}
    </div>
  );
}
