import type { ReactNode } from 'react';
import { Heading } from '@astryxdesign/core/Text';

type SectionHeaderProps = {
  /** Visible + accessible section title, set in the display font (Archivo). */
  title: string;
  /** Id applied to the heading so a panel landmark can `aria-labelledby` it. */
  headingId?: string;
  /** Optional right-aligned chip (e.g. a provenance chip in later tasks). */
  chip?: ReactNode;
  /** Optional one-line descriptor shown under the tick line (orients the
   * section in a sentence). A node, so numeric tokens can wear mono. */
  description?: ReactNode;
};

// DESIGN.md § Signature: "Section headers sit above a ruled tick line, not a
// plain rule." Shared by every section (this task only renders placeholders).
export default function SectionHeader({ title, headingId, chip, description }: SectionHeaderProps) {
  return (
    <div>
      <div className="section-header-row">
        <Heading id={headingId} level={2} textWrap="balance" style={{ letterSpacing: '-0.02em' }}>
          {title}
        </Heading>
        {chip}
      </div>
      <div className="tick-rule" aria-hidden="true" />
      {description && <p className="section-desc">{description}</p>}
    </div>
  );
}
