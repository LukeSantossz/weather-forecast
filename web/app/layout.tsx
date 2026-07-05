import type { Metadata } from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './theme.css';
import { Link } from '@astryxdesign/core/Link';
import { archivo, hankenGrotesk, ibmPlexMono } from './fonts';
import DataStatusBanner from '../components/DataStatusBanner';
import ThemeToggle from '../components/ThemeToggle';
import MethodologyNote from '../components/MethodologyNote';
import meta from '../public/data/meta.json';

const SITE_NAME = 'Weather · Forecast Console';
const SITE_DESCRIPTION =
  'A meteorological instrument console for global daily-mean temperature: forecast, anomalies, and drivers, with every number\'s provenance shown.';

// Absolute base for Open Graph / Twitter image URLs. Vercel exposes the real
// production domain at build time (VERCEL_PROJECT_PRODUCTION_URL), so the
// static export resolves the self-contained OG image to a correct absolute URL
// on deploy without hardcoding a guessed domain; local builds fall back to
// localhost. Override with NEXT_PUBLIC_SITE_URL if a custom domain is assigned.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    // Image is contributed by app/opengraph-image.tsx (generated at build).
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
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
            <div className="console-header-brand">
              <span className="console-mark">WEATHER · FORECAST CONSOLE</span>
              <p className="console-tagline">
                A global daily-mean temperature console. Every number shows its provenance.
              </p>
            </div>
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
        <MethodologyNote />
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
