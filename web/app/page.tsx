'use client';

import { useCallback, useEffect, useState } from 'react';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import SectionHeader from '../components/SectionHeader';
import ForecastSection from '../components/forecast/ForecastSection';

type SectionId = 'forecast' | 'anomalies' | 'drivers';

const SECTIONS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'anomalies', label: 'Anomalies' },
  { id: 'drivers', label: 'Drivers' },
];

const DEFAULT_SECTION: SectionId = 'forecast';

function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((section) => section.id === value);
}

function readHashSection(): SectionId {
  const hash = window.location.hash.replace('#', '');
  return isSectionId(hash) ? hash : DEFAULT_SECTION;
}

// Astryx's TabList/Tab render a plain <nav> of buttons with `aria-current`
// (not the WAI-ARIA tabs/tabpanel pattern — verified against the compiled
// component source, no role="tab"/roving tabindex is implemented there).
// Native button semantics still give a full keyboard path (Tab + Enter/
// Space); panels are toggled with the plain `hidden` attribute, which keeps
// inactive panels out of the a11y tree and tab order for free.
export default function Page() {
  // Starts at the default on both the static-exported HTML and the client's
  // first hydration pass (no `window` access yet), then corrects to the
  // real URL hash in an effect. Assumption: a brief flash from "Forecast" to
  // a deep-linked tab on load is an acceptable tradeoff for a static export
  // with no blocking script for hash state (cheap to revisit).
  const [active, setActive] = useState<SectionId>(DEFAULT_SECTION);

  useEffect(() => {
    setActive(readHashSection());
    const onHashChange = () => setActive(readHashSection());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleChange = useCallback((value: string) => {
    if (!isSectionId(value)) return;
    setActive(value);
    window.location.hash = value;
  }, []);

  return (
    <div>
      <TabList value={active} onChange={handleChange} hasDivider>
        {SECTIONS.map((section) => (
          <Tab
            key={section.id}
            value={section.id}
            label={section.label}
            id={`tab-${section.id}`}
            aria-controls={`panel-${section.id}`}
          />
        ))}
      </TabList>

      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={`panel-${section.id}`}
          className="console-panel"
          aria-labelledby={`heading-${section.id}`}
          hidden={active !== section.id}
        >
          <SectionHeader title={section.label} headingId={`heading-${section.id}`} />
          {section.id === 'forecast' ? (
            <ForecastSection />
          ) : (
            <p className="console-panel-placeholder">Built in a later task.</p>
          )}
        </section>
      ))}
    </div>
  );
}
