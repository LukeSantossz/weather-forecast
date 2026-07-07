import { Badge } from '@astryxdesign/core/Badge';

/** DESIGN.md § Signature: the recurring honesty chip used wherever a number carries provenance. */
export type ProvenanceTone = 'sample' | 'pending' | 'final' | 'holdout' | 'info' | 'danger';

export interface ProvenanceChipProps {
  /** Real, visible text - provenance is never color-only (DESIGN.md § Accessibility).
   * Callers include the literal bracket motif, e.g. `[ HOLDOUT ]`, matching
   * the existing DataStatusBanner convention. */
  label: string;
  /** Maps to a DESIGN.md semantic color token; see the overrides in app/theme.css. */
  tone: ProvenanceTone;
  /** Optional tooltip for a longer explanation of the chip's meaning. */
  title?: string;
}

// Astryx Badge's semantic variants (success/warning/error/info) are hardcoded
// literal colors, not CSS-variable driven, so they can't be retheme'd. Its
// non-semantic "color" variants read `--color-*-<name>` vars instead, which
// app/theme.css remaps onto DESIGN.md's semantic tones (see the comment
// there). `holdout` is a plain descriptive tag, not an alert state, so it
// maps to Badge's neutral variant.
const TONE_VARIANT: Record<ProvenanceTone, 'green' | 'yellow' | 'red' | 'cyan' | 'neutral'> = {
  final: 'green',
  sample: 'yellow',
  pending: 'yellow',
  danger: 'red',
  info: 'cyan',
  holdout: 'neutral',
};

// Astryx Badge base; themed via the `.provenance-chip` class in app/theme.css
// (mono, uppercase, bordered, small radius) rather than re-implemented.
export default function ProvenanceChip({ label, tone, title }: ProvenanceChipProps) {
  return (
    <span title={title}>
      <Badge variant={TONE_VARIANT[tone]} label={label} className="provenance-chip" />
    </span>
  );
}
