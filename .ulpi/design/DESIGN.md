# DESIGN.md — Weather Forecast Dashboard (locked design language)

> Source of truth for identity. Every screen binds to this; variation within identity, never between.
> Re-read first every session before any UI work.

## Register & design system

- **Register:** product (a data instrument, not a marketing brand site).
- **Design system:** **Astryx** (`@astryxdesign/core` `0.1.2`, pre-compiled CSS). We THEME Astryx with the
  tokens below by overriding its CSS-variable tokens; we do NOT re-implement its components. Custom work
  is limited to the chart/dataviz layer (Astryx has no charts) and the signature elements.

## Design Read & direction

**Design Read:** an honest meteorological instrument — reading a precision console where every number
shows its provenance. The bet: for an ML-hiring skim, rigor + visible honesty beat generic polish.

**Aesthetic direction (committed):** `technical / utilitarian` — a "meteorological instrument console."
**Counterfactual/slop check:** the category-default answer for a weather product is blue (both inspiration
sites are blue). We deliberately reject weather-blue as the brand hue and lead with a warm **amber signal**
accent + a graphite instrument neutral, so the category does not predict the aesthetic.

**Inspiration DNA (synthesized, not cloned):**
- *Tomorrow.io* → take: dark console + light data-panel contrast, confident type, the alert+map operational
  motif. drop: the lead-gen form hero, stock avatars, the SaaS gradient, the weather-blue.
- *Weather Company* → take: the stat-with-footnote as a credibility device (maps to our honesty states),
  calm whitespace, measured tone. drop: consumer-cute copy, carousel, marketing vagueness, the blue.

## Color — strategy `restrained`: tinted graphite + exactly one accent

Neutrals are tinted cool (a whisper of cyan, OKLCH hue ~240) so grays never read generic. Hex is
approximate from OKLCH; the engineer verifies exact WCAG ratios in code.

**Dark (primary "instrument" mode)**
| role | OKLCH (L C H) | ~hex | notes |
|---|---|---|---|
| background | 0.17 0.012 240 | #14171c | the console body |
| surface | 0.21 0.012 240 | #1b1f26 | panels |
| elevated | 0.26 0.012 240 | #242a33 | raised cards, popovers |
| border | 0.33 0.014 240 | #343c47 | hairlines, ticks |
| text | 0.95 0.008 240 | #eef1f5 | primary (~15:1 on bg) |
| muted | 0.72 0.012 240 | #a3adba | secondary (~7:1) |
| subtle | 0.55 0.014 240 | #71808f | large/decorative only; small essential text uses `muted` |

**Light (re-derived, not inverted — keeps the cool tint)**
| role | OKLCH | ~hex | notes |
|---|---|---|---|
| background | 0.975 0.006 240 | #f6f8fa | cool off-white (NOT cream) |
| surface | 1.0 0 0 | #ffffff | panels |
| elevated | 0.985 0.006 240 | #fbfcfe | + soft shadow for lift |
| border | 0.90 0.010 240 | #dde2e9 | hairlines, ticks |
| text | 0.22 0.014 240 | #1c2128 | primary (~14:1) |
| muted | 0.45 0.016 240 | #5b6672 | secondary (~7:1) |
| subtle | 0.62 0.016 240 | #8592a0 | large/decorative only; small essential text uses `muted` |

**Accent — the single accent, warm amber (signal: heat / alert / the hero value)**
| token | OKLCH | ~hex | use |
|---|---|---|---|
| accent | 0.72 0.145 68 | #e0942e | key values, active state, primary CTA fill, ensemble series |
| accent-strong | 0.66 0.150 62 | #c87e1f | hover/pressed |
| on-accent | 0.20 0.01 240 | #1c2128 | text ON amber fills (always dark; amber is never body text on light) |

Distribution ~60-30-10: graphite surfaces (60) / mid neutrals + gridlines (30) / amber accent (10).

**Semantic states** (same chroma language; distinct from the accent)
| state | ~hex (dark / light) | meaning |
|---|---|---|
| success / final | #3fae7a / #1f8f5c | metric row is `final` |
| warning / pending | #d8b23a / #b8902a | `pending_rerun` (distinct yellow, not the amber accent) |
| danger / severe | #e0603f / #cc4a2e | severe anomaly, "both-method" overlap |
| info / cool | #4aa6c9 / #2f88ab | the cool pole; z-score method |

**Contrast rule for colored text (AA compliance):** bright tones above are for
fills / lines / borders / markers (UI, ≥ 3:1); small COLORED text uses a darker
(light) / brighter (dark) `-text` variant that reaches ≥ 4.5:1 on its actual
background. Text `-text` variants (dark / light), for tone-tinted chip text:
`success-text` #76c5a0 / #187148 · `warning-text` #ddbc53 / #7e631d ·
`danger-text` #eb9781 / #a93d26 · `info-text` #7dbfd8 / #256b86. The bright tones
are unchanged and keep the identity; only small colored text darkens/brightens.

## Dataviz palette (charts only — separate from the one UI accent)

- **Temperature (diverging):** amber `#e0942e` (warm/high) ↔ neutral ↔ cool `#4aa6c9` (low). Encodes the
  real physical axis.
- **Forecast series (categorical, colorblind-checked):** actual = high-contrast neutral (text color, thick);
  **Ensemble (weighted) = amber accent** (the hero); LightGBM = info-cyan; SARIMA = violet `#8b7fd6`;
  ARIMA = teal `#3fae7a`; Prophet = rose `#d98aa8`. Direct-label lines; no rainbow.
- **Anomaly methods:** z-score = info-cyan; isolation-forest = violet; **both (overlap) = danger** (the
  strongest, agreed signal).
- **Series end-label text** (small colored SVG text) uses a light-mode-darkened `-text` variant of each
  series color so it reaches ≥ 4.5:1 on the chart surface; the LINES keep the bright series colors (UI,
  ≥ 3:1). Label `-text` (light / dark = bright): ensemble #9e6820 / #e0942e · lightgbm #2b7c9c / #4aa6c9 ·
  sarima #746ab3 / #8b7fd6 · arima #1d8455 / #3fae7a · prophet #9b6378 / #d98aa8. Dark labels already pass,
  so the dark side keeps the bright series hex.
- Rule: sequential/diverging for magnitude, categorical only for identity; never encode meaning by hue
  alone (pair with shape/label). Bright tones for fills/lines/markers ≥ 3:1; darker `-text` variants for
  small colored text ≥ 4.5:1. Validate contrast + colorblind safety at build (dataviz skill validator).

## Type — paired on a contrast axis (none are the banned reflex defaults)

- **Display** (section headers, the hero stat): **Archivo** — a technical grotesk with signage character;
  used with restraint, tight tracking (≈ −0.02em at large sizes), `text-wrap: balance`.
- **Body / UI:** **Hanken Grotesk** — humanist-geometric, quiet, readable (measure 65–75ch).
- **Data / mono:** **IBM Plex Mono** — ALL numbers, axis ticks, footnotes, and the provenance/status
  chips. The mono is the honesty voice: exact figures wear mono.
- Loaded via `next/font/google` (Archivo, Hanken Grotesk, IBM Plex Mono — self-hosted at build, no runtime
  CDN, metric-matched fallbacks). Chosen over the Fontshare picks (Cabinet Grotesk / General Sans) so the
  static build needs no committed font binaries, keeping the same industrial-grotesk + humanist + mono
  contrast axis and still avoiding the banned reflex defaults.
- We override Astryx's font tokens with these three roles.

**Modular scale** (product-tight, 1.20): 12 · 14 · 16(base) · 19 · 23 · 28 · 34 · 41 · 49 px. Numbers in
the hero stat may go larger (mono, tabular figures).

## Structural scales (locked)

- **Spacing** (4px rhythm): 0 2 4 8 12 16 20 24 32 40 48 64 80 96 128.
- **Radius:** `{ sm 4, md 8, lg 12, xl 16, full 9999 }` — favor the small end (an instrument is crisp, not pillowy).
- **Shadow:** soft, low-opacity, only where elevation is real (popover, modal, the floating alert card). Dark
  mode leans on borders over shadows.
- **Z-index:** base 0, dropdown 20, sticky 30, fixed 40, modalBackdrop 45, modal 50, popover 60, toast 70, skipLink 80.
- **Breakpoints:** sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536; container max 1200.
- **Motion:** fast 120 · base 260 · emphasis 440; easing `cubic-bezier(0.16, 1, 0.3, 1)`; no bounce/elastic;
  exit ≈ 75% of enter; honor `prefers-reduced-motion`. One orchestrated page-load reveal per section, and
  chart draw-in on first view. Motion must be motivated.

## Signature (the recurring distinctive element)

1. **Precision ticks** — a fine 1px tick/graticule motif (border color) framing panels and forming the
   chart axes: the console-bezel look. Section headers sit above a ruled tick line, not a plain rule.
2. **Provenance chips** — small IBM Plex Mono, uppercase, bordered chips that make honesty first-class:
   `[ SAMPLE DATA ]`, `[ PENDING RE-RUN ]`, `[ FINAL ]`, `[ HOLDOUT ]`, `[ GLOBAL DAILY MEAN ]`. Built on
   Astryx Badge/StatusDot, themed. Every claim/number that has provenance wears one.

These two are used on every section — they are how a viewer instantly recognizes the product and reads it
as honest.

## Voice

Precise, plain, measured. Numbers carry units and provenance. No buzzwords (no "powerful", "seamless",
"revolutionary"). No em-dash as a crutch in UI copy. Example: "Global daily mean · 30-day holdout" not
"revolutionary global accuracy". Consistent action vocabulary across a flow.

## Accessibility guarantees (locked)

- WCAG AA: 4.5:1 body text, 3:1 large text + UI/icons + chart strokes; verified in code per pairing.
- Never color alone: series and methods carry a label or shape too; provenance is text, not just color.
- Full keyboard path; visible focus ring (2px, accent, 2px offset); honor reduced-motion; charts have
  text/table equivalents (the metrics table IS the accessible form of the forecast numbers).
- Touch targets ≥ 44px (map markers get an enlarged invisible hit area); respect mobile safe areas.
