import type { Metadata } from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './theme.css';
import { Link } from '@astryxdesign/core/Link';
import { archivo, hankenGrotesk, ibmPlexMono } from './fonts';
import DataStatusBanner from '../components/DataStatusBanner';
import ThemeToggle from '../components/ThemeToggle';
import meta from '../public/data/meta.json';

export const metadata: Metadata = {
  title: 'Weather · Forecast Console',
  description:
    'A meteorological instrument console: global daily-mean temperature forecast, anomalies, and drivers.',
};

const REPO_URL = 'https://github.com/LukeSantossz/weather-forecast#readme';

// Runs before hydration (plain <script>, not next/script) so the light/dark
// mode is correct on first paint with no flash. Reads localStorage, falls
// back to prefers-color-scheme. See components/ThemeToggle.tsx for the
// runtime toggle that also writes this attribute + localStorage key.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var m=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',m);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-astryx-theme="neutral"
      suppressHydrationWarning
      className={`${archivo.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <header className="console-header">
          <div className="shell-container console-header-row">
            <span className="console-mark">WEATHER · FORECAST CONSOLE</span>
            <div className="console-header-actions">
              <ThemeToggle />
              <Link href={REPO_URL} isExternalLink>
                Methodology
              </Link>
            </div>
          </div>
          <div className="tick-rule" aria-hidden="true" />
        </header>
        <DataStatusBanner />
        <main className="shell-container">{children}</main>
        <footer className="console-footer">
          <div className="tick-rule" aria-hidden="true" />
          <div className="shell-container console-footer-row">
            <span>
              {meta.pipeline.source} · schema v{meta.schema_version} · generated {meta.generated_at}
            </span>
            <span>Global daily-mean model built from 211 countries&apos; data.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
