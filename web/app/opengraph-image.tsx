import { ImageResponse } from 'next/og';

// Self-contained social-share card (Open Graph + Twitter). Generated as a
// static PNG at build time by next/og — no runtime service, no external asset
// host. Colors are DESIGN.md's locked amber-on-graphite instrument palette,
// transcribed verbatim (the same values app/theme.css binds to Astryx tokens).
// Emit as a static file at build time (required under next.config `output: export`).
export const dynamic = 'force-static';
export const alt = 'Weather · Forecast Console, a global daily-mean temperature instrument.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GRAPHITE = '#14171c';
const SURFACE = '#1b1f26';
const BORDER = '#343c47';
const TEXT = '#eef1f5';
const MUTED = '#a3adba';
const AMBER = '#e0942e';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: GRAPHITE,
          color: TEXT,
          padding: '72px 80px',
        }}
      >
        {/* Provenance chip — the honesty signature */}
        <div style={{ display: 'flex' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              letterSpacing: 2,
              color: AMBER,
              border: `2px solid ${BORDER}`,
              borderRadius: 6,
              padding: '10px 18px',
            }}
          >
            [ GLOBAL DAILY MEAN ]
          </div>
        </div>

        {/* Headline + one-line value statement */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>
            Global daily-mean temperature console
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 34, color: MUTED, lineHeight: 1.3 }}>
            Forecast, anomalies, and drivers. Every number shows its provenance.
          </div>
        </div>

        {/* Ruled tick line (the console bezel) + footer row */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', height: 2, background: BORDER, marginBottom: 28 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', fontSize: 26, color: MUTED, letterSpacing: 1 }}>
              211 countries · 30-day holdout
            </div>
            {/* Instrument mark: rising amber line over a tick baseline */}
            <div
              style={{
                display: 'flex',
                width: 108,
                height: 108,
                background: SURFACE,
                border: `2px solid ${BORDER}`,
                borderRadius: 16,
              }}
            >
              <svg width="108" height="108" viewBox="0 0 32 32">
                <path d="M5 24 H27" stroke={BORDER} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M9 24 v-2 M15 24 v-2 M21 24 v-2" stroke={BORDER} strokeWidth="1.5" strokeLinecap="round" />
                <path
                  d="M6 21 L12 15 L18 17 L26 7"
                  fill="none"
                  stroke={AMBER}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="26" cy="7" r="2.5" fill={AMBER} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
