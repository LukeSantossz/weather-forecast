'use client';

import { useEffect } from 'react';
import SectionHeader from '../components/SectionHeader';
import ForecastSection from '../components/forecast/ForecastSection';
import AnomaliesSection from '../components/anomalies/AnomaliesSection';
import DriversSection from '../components/drivers/DriversSection';
import CloseSection from '../components/CloseSection';

type SectionId = 'forecast' | 'anomalies' | 'drivers';

// One-line descriptors shown under each section header (drivers carries its own
// PM2.5 framing chip instead). Numeric tokens wear mono, matching DESIGN.md's
// "exact figures wear mono" voice.
const SECTION_DESCRIPTIONS: Partial<Record<SectionId, React.ReactNode>> = {
  forecast: (
    <>
      Daily-mean temperature across <span className="section-desc-num">211</span> countries, scored on a{' '}
      <span className="section-desc-num">30-day</span> holdout.
    </>
  ),
  anomalies: <>Temperature outliers flagged by z-score and Isolation Forest, mapped by location.</>,
};

const SECTIONS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'anomalies', label: 'Anomalies' },
  { id: 'drivers', label: 'Drivers' },
];

// Single-scroll narrative (Task 3): every section rendered at once in order,
// then CloseSection - no tabs, no hash-router state. Deep links (e.g.
// `/#anomalies`) resolve natively because the ids live on the <section>
// elements themselves. Hero renders just above this fragment as a sibling in
// app/layout.tsx, not here (Task 4 review fix: it needs to be a direct
// child of <body> for the warming-stripes signature to reach full viewport
// width, outside this component's own <main class="shell-container">).
export default function Page() {
  // Drives the shared .reveal -> .reveal.in entrance for every act (ported
  // from the template's REVEALS IIFE). Under prefers-reduced-motion, `.in` is
  // added to every `.reveal` immediately instead of observing, so content is
  // never hidden.
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      reveals.forEach((el) => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    reveals.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="act reveal" aria-labelledby={`heading-${section.id}`}>
          <SectionHeader
            title={section.label}
            headingId={`heading-${section.id}`}
            description={SECTION_DESCRIPTIONS[section.id]}
          />
          {section.id === 'forecast' && <ForecastSection />}
          {section.id === 'anomalies' && <AnomaliesSection />}
          {section.id === 'drivers' && <DriversSection />}
        </section>
      ))}
      <CloseSection />
    </>
  );
}
