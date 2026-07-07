import type { ReactNode } from 'react';
import { Heading } from '@astryxdesign/core/Text';

type SectionHeaderProps = {
  /** Visible + accessible section title, set in the display font (serif). */
  title: string;
  /** Id applied to the heading so a panel landmark can `aria-labelledby` it. */
  headingId?: string;
  /** Optional right-aligned chip (e.g. DriversSection's PM2.5 model chip). */
  chip?: ReactNode;
  /** Optional one-line lede shown under the act number/title (orients the
   * section in a sentence). A node, so numeric tokens can wear mono. */
  description?: ReactNode;
  /** Mono act number rendered before the title, e.g. "01" (page.tsx threads
   * "01"/"02"/"03" per section by order). Omitted entirely for non-act uses
   * of this shared header (e.g. DriversSection's inner sub-heading). */
  actNumber?: string;
};

// The numbered "act" header (ported from the approved observatory design
// preview's `.acthead`/`.actnum`/`.actt`/`.actlede`):
// a mono act number, the serif title, and a one-line lede. Shared by every
// section; page.tsx threads the act number per section's order.
export default function SectionHeader({ title, headingId, chip, description, actNumber }: SectionHeaderProps) {
  return (
    <div>
      <div className="acthead">
        {actNumber && <span className="actnum">{actNumber}</span>}
        <div className="section-header-row">
          <Heading id={headingId} level={2} className="actt" textWrap="balance">
            {title}
          </Heading>
          {chip}
        </div>
      </div>
      {description && <p className="actlede">{description}</p>}
    </div>
  );
}
