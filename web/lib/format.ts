// web/lib/format.ts
//
// Shared provenance formatters for the committed meta.json contract. These were
// hand-rolled identically in components/DataStatusBanner.tsx, app/layout.tsx,
// and components/CloseSection.tsx; extracted here so the commit sha / generation
// date render the same way everywhere. Behavior is intentionally unchanged.

/** Short 7-char git sha, with an 'unknown' fallback for null/undefined (sample data). */
export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : 'unknown';
}

/** ISO timestamp rendered as YYYY-MM-DD; returns the raw string if it cannot be parsed. */
export function shortDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toISOString().slice(0, 10);
}
