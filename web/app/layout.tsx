import type { Metadata } from 'next';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './theme.css';
import { display, hankenGrotesk, ibmPlexMono } from './fonts';
import DataStatusBanner from '../components/DataStatusBanner';
import Hero from '../components/Hero';
import ThemeToggle from '../components/ThemeToggle';
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

// Minimal commit line for the footer (the full colophon lives in
// components/CloseSection.tsx). Mirrors the shortSha/shortDate helpers in
// components/DataStatusBanner.tsx - same defensive handling, kept local since
// this is the only other place the repo commit / generation date are shown.
function shortCommit(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : 'unknown';
}

function shortDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toISOString().slice(0, 10);
}

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
      className={`${display.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {/* The slim sticky bar (single-scroll shell, Task 3): wordmark + ember
            status dot on the left, the "Live model output" chip and the theme
            toggle on the right. Ported from the Observatory design preview
            template's `<header class="bar">`. */}
        <header className="bar">
          <div className="shell-container bar-in">
            <span className="wordmark">
              <span className="dot" aria-hidden="true" />
              WEATHER · FORECAST OBSERVATORY
            </span>
            <div className="bar-right">
              <span className="chip">
                <span className="live" aria-hidden="true" />
                Live model output
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <DataStatusBanner />
        {/* Direct child of <body>, not <main class="shell-container"> (Task 4
            review fix): the warming-stripes signature (`.hero`, position:
            relative/overflow:hidden) must reach the viewport edge, and the
            shell's max-width:1200px + padding-inline column would otherwise
            cap the stripes to the padded content column instead of true
            full-bleed. `<body>` carries no margin/padding (Astryx's reset.css
            zeroes body margin; nothing in this codebase adds body padding),
            so Hero here spans the full document width with no 100vw
            break-out and no `overflow-x` hack. `.hero-in` (app/theme.css)
            now carries its own max-width:1200px + padding-inline to keep the
            headline/stats aligned with the acts inside `.shell-container`
            below. */}
        <Hero />
        <main className="shell-container">{children}</main>
        <footer className="site-footer">
          <div className="shell-container site-footer-line">
            commit {shortCommit(meta.pipeline.repo_commit)} · generated {shortDate(meta.generated_at)}
          </div>
        </footer>
      </body>
    </html>
  );
}
