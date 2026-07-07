# Observatory Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme the Astryx dashboard into the "Observatory" identity and restructure the three tabs into one scrollytelling narrative, without touching the Python pipeline or the data contract.

**Architecture:** The identity is applied by rewriting the CSS-variable token values and structural classes in `web/app/theme.css` (Astryx components read these tokens, so they reskin for free), swapping the display font in `web/app/fonts.ts`, and replacing the tab shell in `web/app/layout.tsx` + `web/app/page.tsx` with a single-scroll page of sections. The bespoke dataviz (forecast chart, MapLibre map, SHAP bars) and the offline semantic search are restyled and re-laid-out, not rebuilt. Every pixel-level style, markup structure, and interaction is already realised in the approved preview at `docs/design/observatory-preview-template.html` (readable source) and `docs/design/observatory-preview.html` (runnable, data inlined); port from there.

**Tech Stack:** Next.js 16 (`output: 'export'`), React 19, `@astryxdesign/core` 0.1.2 (themed via CSS vars, never re-implemented), `next/font/google`, d3-scale/d3-shape (forecast chart), maplibre-gl (anomaly map). No new dependencies.

## Global Constraints

Copied verbatim from `docs/specs/0031-observatory-visual-redesign.md`. Every task's requirements implicitly include this section.

- **No pipeline/contract change.** Do not edit anything under `src/`, `web/public/data/`, or `web/public/data/schema/`. Swapping the data must still change zero `.tsx`/`.ts` data lines (SPEC 0006 ADR-D).
- **Astryx stays; theme it, do not re-implement.** Astryx imports live only in `web/components/` and `web/app/`; retheme via CSS-variable overrides in `theme.css` only. No shadcn, no new component library, no new heavy front-end dependency beyond the already-present Astryx, MapLibre, and d3 (SPEC 0006 ADR-B).
- **Honesty in the data, not apology in the copy.** Keep `data_status` / `status` handling (SPEC 0006 ADR-E), but with `data_status: "real"` and all metrics `final` the rendered output must contain none of: `SAMPLE DATA`, `PENDING RE-RUN`, `withheld`, `#20`.
- **No em-dashes** in any UI copy or artifact (house preference). Use hyphens, colons, or periods.
- **Accessibility (WCAG AA).** 4.5:1 body text, 3:1 large text + UI + chart strokes; full keyboard path; visible 2px accent focus ring at 2px offset; `prefers-reduced-motion` disables reveal/stripe/draw-in animation; charts keep a table or text equivalent; touch targets >= 44px.
- **Responsive.** Body never scrolls horizontally from 320px to 1536px; the forecast chart reflows to container width with axis labels >= ~9px.
- **Pinned deps, exact.** `@astryxdesign/core` and `@astryxdesign/theme-neutral` stay pinned `0.1.2`; commit the lockfile if `web/package.json` changes.
- **All output in English.** SPEC/PR/commit artifacts are full prose (no terse mode).

## Verification model (read before Task 1)

`web/package.json` has no test runner (only `dev`/`build`/`preview`), and the spec forbids adding one. So the red-green cycle is adapted per task to the tools that exist:

- **Automated checks (real red-green):** a Node check script `web/scripts/check-redesign.mjs` (Task 2) greps the built `web/out/` and the source for the forbidden strings and for `TabList`, and asserts the data-contract files are unchanged by `git`. Written first so it FAILS against `main`, then goes green as tasks land.
- **Build gate:** `cd web && npm run build` must succeed with zero errors for every task that touches `web/`.
- **Palette gate:** the dataviz palette validator (bundled skill) run on the Observatory palette, light and dark.
- **Browser gate:** load `web/out` (`npx serve out`) and verify visually with the `/verify` skill or claude-in-chrome at desktop (1280) and mobile (360) widths, checking the specific behaviour named in the task.

Each task's "verify" steps name which gates apply. A task is done only when its gates pass.

## File Structure

**Modify**
- `web/app/fonts.ts` - swap the display face (Archivo -> a serif) exposed as `--font-display`; keep `--font-body`, `--font-mono`.
- `web/app/theme.css` - rewrite the token values (Observatory palette) and the structural/shell/section classes; add hero/stripes/act/leaderboard/metric-card/semantic/colophon classes; add responsive + reduced-motion rules. Source of truth for styles: `docs/design/observatory-preview-template.html`.
- `web/app/layout.tsx` - shell becomes a slim sticky header (wordmark + live-output chip + theme toggle) + the reframed banner; footer becomes the colophon; drop the bottom `MethodologyNote` mount (moves into the Anomalies act as a short aside). Update the font `className`.
- `web/app/page.tsx` - replace `TabList`/`Tab` with one scroll of `<section>`s (`#forecast`, `#anomalies`, `#drivers`) plus a hero and close; add an IntersectionObserver reveal.
- `web/components/DataStatusBanner.tsx` - confident `Live model output - commit - date` for the `real` state; keep a non-default `sample` state.
- `web/components/MethodologyNote.tsx` - reduce to a short "how to read this" aside; delete the `PENDING RE-RUN` / `LEAKAGE FIX PENDING #20` items.
- `web/components/SectionHeader.tsx` - act header: mono act number + serif title + one-line lede.
- `web/components/forecast/ForecastSection.tsx` - remove the stale "withheld pending re-run #20" hero note; keep the honest best-model hero.
- `web/components/forecast/ForecastChart.tsx` - render to container width and reflow on resize (ResizeObserver); keep the a11y table.
- `web/components/anomalies/AnomaliesSection.tsx` - act layout: metric trio, then map + ticker, then semantic search.
- `web/components/anomalies/AnomalyMap.tsx` - restyle to the Observatory tokens; add a `highlightRecords(records)` imperative handle for the semantic cross-link.
- `web/components/anomalies/SemanticSearch.tsx` - restyle to chips + animated ranked rows; call the map's `highlightRecords` on query change.
- `web/components/drivers/*` - restyle the SHAP bars (magnitude ramp) + one-line reading.
- `.ulpi/design/DESIGN.md` - rewrite to the Observatory identity (new locked source of truth).

**Create**
- `web/components/Hero.tsx` - thesis hero: warming-stripes backdrop (from `forecast.json` history+actual) + hero-stat row (from `metrics.json`).
- `web/components/CloseSection.tsx` - reproducibility framing + engineering colophon.
- `web/scripts/check-redesign.mjs` - the automated redesign check (forbidden strings, no `TabList`, contract untouched).

**Reference (already committed this session)**
- `docs/design/observatory-preview-template.html` - the exact CSS, markup, and JS to port (readable).
- `docs/design/observatory-preview.html` - the same, runnable with data inlined.

---

## Task 1: Lock the identity - rewrite DESIGN.md and land the redesign check (red)

**Files:**
- Modify: `.ulpi/design/DESIGN.md`
- Create: `web/scripts/check-redesign.mjs`

**Interfaces:**
- Produces: `docs/design/observatory-preview-template.html` is the style source referenced by later tasks; `web/scripts/check-redesign.mjs` is the automated gate reused by every later task.

- [ ] **Step 1: Rewrite `.ulpi/design/DESIGN.md` to the Observatory identity.** Replace the "instrument console" register, palette, and type sections with: register = editorial data-journalism instrument; palette = warm-ink neutrals + single ember accent + glacier-cyan cool pole (values below, Task 2); type = serif display + grotesk body + mono data; signature = warming-stripes + provenance chips reframed as confidence cues. Keep the Structural scales, Motion, Accessibility, and Dataviz-rule sections. No em-dashes. Note at top that this supersedes the prior locked identity per SPEC 0031 / ADR-F.

- [ ] **Step 2: Write the redesign check (the failing test).**

```js
// web/scripts/check-redesign.mjs
// Run after `npm run build`. Asserts the redesign's testable acceptance criteria.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const OUT = new URL('../out/', import.meta.url).pathname;
const FORBIDDEN = ['SAMPLE DATA', 'PENDING RE-RUN', 'withheld', '#20'];

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let failed = false;
const fail = (m) => { console.error('FAIL:', m); failed = true; };

// 1) No stale caveat strings in built HTML/text.
const htmlFiles = walk(OUT).filter((f) => f.endsWith('.html') || f.endsWith('.txt'));
for (const f of htmlFiles) {
  const body = readFileSync(f, 'utf8');
  for (const s of FORBIDDEN) if (body.includes(s)) fail(`forbidden string "${s}" in ${f}`);
}

// 2) No TabList in the page source (single-scroll IA).
const page = readFileSync(new URL('../app/page.tsx', import.meta.url).pathname, 'utf8');
if (page.includes('TabList')) fail('app/page.tsx still imports/uses TabList');

// 3) The data contract is untouched by this branch.
const changed = execSync('git diff --name-only origin/main -- web/public/data', { cwd: new URL('..', import.meta.url).pathname })
  .toString().trim();
if (changed) fail(`data contract changed:\n${changed}`);

if (failed) { console.error('\nredesign check FAILED'); process.exit(1); }
console.log('redesign check passed');
```

- [ ] **Step 3: Run it against `main` and confirm it FAILS.**

Run: `cd web && npm run build && node scripts/check-redesign.mjs`
Expected: FAIL - the current build still renders `SAMPLE DATA` / `#20` and `page.tsx` still uses `TabList`.

- [ ] **Step 4: Commit.**

```bash
git add .ulpi/design/DESIGN.md web/scripts/check-redesign.mjs docs/design/observatory-preview.html docs/design/observatory-preview-template.html
git commit -m "docs(design): lock the observatory identity and add the redesign check"
```

---

## Task 2: Observatory tokens and fonts

**Files:**
- Modify: `web/app/fonts.ts`, `web/app/theme.css:33-163` (the `:root` token block), `web/app/layout.tsx:7,62`
- Reference: `docs/design/observatory-preview-template.html` (`:root` and `@media (prefers-color-scheme: dark)` blocks)

**Interfaces:**
- Produces: the token contract every component already consumes: `--color-background-{body,surface,card,muted,popover}`, `--color-text-{primary,secondary,disabled,accent}`, `--color-{accent,on-accent,border}`, `--color-{success,warning,danger,info}(-muted|-text)`, `--viz-*`, `--font-{display,body,mono}`, `--radius-*`, `--motion-*`. Names are unchanged; only values change.

- [ ] **Step 1: Swap the display font to a serif.** In `web/app/fonts.ts`, replace the `Archivo` import/export with a serif display face and keep the other two:

```ts
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';

export const display = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

export const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body', display: 'swap',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap',
});
```

Update `web/app/layout.tsx`: import `{ display, hankenGrotesk, ibmPlexMono }` and set `className={`${display.variable} ${hankenGrotesk.variable} ${ibmPlexMono.variable}`}`.

- [ ] **Step 2: Rewrite the token values in `theme.css`.** Replace the hex in the `:root` block (lines ~33-163) with the Observatory palette, keeping the `light-dark(light, dark)` form and the exact token names:

```css
  --color-background-body: light-dark(#f7f6f3, #141210);
  --color-background-surface: light-dark(#ffffff, #1b1815);
  --color-background-card: light-dark(#ffffff, #1b1815);
  --color-background-muted: light-dark(#f7f6f3, #141210);
  --color-background-popover: light-dark(#ffffff, #24201b);

  --color-text-primary: light-dark(#201c18, #f3ece2);
  --color-icon-primary: light-dark(#201c18, #f3ece2);
  --color-text-secondary: light-dark(#5e574e, #a79e92);
  --color-icon-secondary: light-dark(#5e574e, #a79e92);
  --color-text-disabled: light-dark(#8b8377, #6f6659);
  --color-icon-disabled: light-dark(#8b8377, #6f6659);

  --color-border: light-dark(#e5e0d8, #37312b);
  --color-border-emphasized: light-dark(#d8d1c6, #453e36);

  --color-accent: light-dark(#d8511c, #f2612c);          /* ember: fills, lines, large */
  --color-text-accent: light-dark(#b8410f, #f7855a);     /* small accent text, AA both themes */
  --color-icon-accent: light-dark(#d8511c, #f2612c);
  --color-accent-muted: light-dark(#d8511c1f, #f2612c33);
  --color-on-accent: light-dark(#ffffff, #1b1712);       /* text ON an ember fill */

  --color-warning: light-dark(#b8902a, #e0b341);
  --color-warning-muted: light-dark(#b8902a29, #e0b34133);
  --color-on-warning: #1b1712;
  --color-success: light-dark(#1f8f5c, #46b482);
  --color-success-muted: light-dark(#1f8f5c29, #46b48233);
  --color-danger: light-dark(#cc4a2e, #e0603f);
  --color-danger-muted: light-dark(#cc4a2e29, #e0603f33);
  --color-info: light-dark(#2e8aa8, #3fa9c7);            /* the cool pole */
  --color-info-muted: light-dark(#2e8aa829, #3fa9c733);

  --color-warning-text: light-dark(#7e631d, #e6c463);
  --color-success-text: light-dark(#187148, #79c9a4);
  --color-danger-text: light-dark(#a93d26, #ef9a80);
  --color-info-text: light-dark(#1f6f8a, #7ec9dd);
```

Keep the `--viz-*` mapping as-is: `--viz-ensemble: var(--color-accent)` (now ember) and `--viz-lightgbm: var(--color-info)` (now the cool pole) update automatically; `--viz-sarima: #8b7fd6` (violet) and `--viz-prophet: #d98aa8` (rose) still read well on warm ink and stay. Update the `--viz-*-text` light-mode values only if the palette validator flags them in Step 4. Font-role, radius, and motion tokens are unchanged (`--font-family-heading: var(--font-display)` now resolves to the serif).

- [ ] **Step 3: Build.**

Run: `cd web && npm run build`
Expected: PASS, zero errors.

- [ ] **Step 4: Validate the palette (light and dark).** Run the dataviz validator on the series/status hues actually used as adjacent categoricals, and on the diverging pair, per mode. Fix any FAIL by nudging the offending `-text` variant only (bright fills stay).

Run (from the dataviz skill base dir):
`node scripts/validate_palette.js "#f2612c,#3fa9c7,#8b7fd6,#46b482,#d98aa8" --mode dark`
`node scripts/validate_palette.js "#d8511c,#2e8aa8,#8b7fd6,#1f8f5c,#d98aa8" --mode light`
Expected: PASS on lightness band, chroma floor, CVD separation, contrast.

- [ ] **Step 5: Browser gate.** `npx serve out`, load it, toggle the theme. Expected: warm-ink ground + ember accent in both light and dark; serif headings; mono numbers; existing tabs/table/chart still render (they reskin automatically). No layout breakage.

- [ ] **Step 6: Commit.**

```bash
git add web/app/fonts.ts web/app/theme.css web/app/layout.tsx
git commit -m "feat(web): apply the observatory palette and serif display"
```

---

## Task 3: The single-scroll shell (layout + page IA)

**Files:**
- Modify: `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/theme.css` (add shell + section-scaffold classes; port from the template's `header.bar`, `section.act`, `.acthead`, `.reveal` rules)
- Reference: `docs/design/observatory-preview-template.html` (`<header class="bar">`, `<main>` acts, and the REVEALS IIFE)

**Interfaces:**
- Consumes: the tokens from Task 2.
- Produces: `page.tsx` renders `<Hero/>`, three `<section id="forecast|anomalies|drivers">`, and `<CloseSection/>` in document order; a shared `.reveal -> .reveal.in` IntersectionObserver drives per-section entrance; the sticky header carries the wordmark, the live-output chip, and `<ThemeToggle/>`.

- [ ] **Step 1: Rewrite `layout.tsx` shell.** Replace the two-line brand + Methodology link header with the slim sticky bar (wordmark with the ember status dot; a `Live model output` chip; `<ThemeToggle/>`), keep `<DataStatusBanner/>` (reframed in Task 8) directly under it, keep `<main>{children}</main>`, drop the bottom `<MethodologyNote/>` mount (it moves into the Anomalies act), and change the footer into the colophon shell (the `<CloseSection/>` owns the colophon content; the `<footer>` keeps only the commit line). Port the exact structure/classes from the template's header and footer.

- [ ] **Step 2: Rewrite `page.tsx` as one scroll (the IA change).**

```tsx
'use client';
import { useEffect } from 'react';
import Hero from '../components/Hero';
import ForecastSection from '../components/forecast/ForecastSection';
import AnomaliesSection from '../components/anomalies/AnomaliesSection';
import DriversSection from '../components/drivers/DriversSection';
import CloseSection from '../components/CloseSection';

export default function Page() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Hero />
      <section id="forecast" className="act reveal" aria-labelledby="h-forecast"><ForecastSection /></section>
      <section id="anomalies" className="act reveal" aria-labelledby="h-anomalies"><AnomaliesSection /></section>
      <section id="drivers" className="act reveal" aria-labelledby="h-drivers"><DriversSection /></section>
      <CloseSection />
    </>
  );
}
```

Each section component renders its own `SectionHeader` with the matching `id="h-<name>"`. Deep links (`/#anomalies`) resolve natively because the ids are on the sections; no hash-router code is needed. Under `prefers-reduced-motion`, add `.in` to every `.reveal` immediately (mirror the template's REVEALS guard).

- [ ] **Step 3: Add the shell + scaffold CSS** to `theme.css` (sticky `.bar`, `.act` padding, `.acthead`, `.actnum`, `.reveal`/`.reveal.in`, and the reduced-motion override), ported verbatim from the template.

- [ ] **Step 4: Build + redesign check.**

Run: `cd web && npm run build && node scripts/check-redesign.mjs`
Expected: the `TabList` assertion now PASSES (page has no TabList); forbidden-string assertions still FAIL until Tasks 6/8 land. Build has zero errors.

- [ ] **Step 5: Browser gate.** Confirm the page scrolls as one narrative, sections reveal on scroll, and `/#anomalies` deep-links scroll to the Anomalies section.

- [ ] **Step 6: Commit.**

```bash
git add web/app/layout.tsx web/app/page.tsx web/app/theme.css
git commit -m "feat(web): replace the tab shell with a single-scroll narrative"
```

---

## Task 4: Hero with the warming-stripes signature

**Files:**
- Create: `web/components/Hero.tsx`
- Modify: `web/app/theme.css` (add `.hero`, `.stripes`, `.hero-veil`, `.hero-in`, `.eyebrow`, `h1.title`, `.lede`, `.herostats`, `.hstat`, `.scrollcue`; port from the template)
- Reference: `docs/design/observatory-preview-template.html` (HERO STRIPES and HERO STATS IIFEs, `.hero*` CSS)

**Interfaces:**
- Consumes: `web/public/data/forecast.json` (`series.history`, `series.actual`) for stripe temperatures; `web/public/data/metrics.json` (`models`) for the best-RMSE hero stat. Import the JSON directly (static export inlines it), same pattern as `DataStatusBanner`.
- Produces: `<Hero/>` used by `page.tsx`.

- [ ] **Step 1: Build the Hero component.** Client component. Compute stripe colours with the diverging temp scale (cool `#3fa9c7` -> neutral `#c9c3b6` -> warm `#f2612c`) over `history.concat(actual)`; render one `<span>` per day in `.stripes`, animating `scaleY(0)->1` staggered (guarded by `prefers-reduced-motion`). Hero stats: best `final` model by `rmse_c` for the RMSE tile, plus `211` countries, `forecast.series.test_window_days` holdout, and model count. Copy from the template's HERO markup and the two hero IIFEs, adapted to read the imported JSON instead of an inlined `DATA` global. Headline and lede copy exactly as in the template (no em-dashes).

- [ ] **Step 2: Add the hero CSS** to `theme.css`, ported from the template.

- [ ] **Step 3: Build.** Run: `cd web && npm run build` - Expected: PASS.

- [ ] **Step 4: Browser gate.** Hero renders the thesis headline, four stat tiles with real numbers (0.27 C RMSE best), and the animated warming stripes; with reduced-motion the stripes are static and fully shown.

- [ ] **Step 5: Commit.**

```bash
git add web/components/Hero.tsx web/app/theme.css
git commit -m "feat(web): add the observatory hero with warming-stripes"
```

---

## Task 5: The Forecast act (responsive chart, no stale copy)

**Files:**
- Modify: `web/components/forecast/ForecastSection.tsx:76-99` (drop the `forecast-hero-note`), `web/components/forecast/ForecastChart.tsx`, `web/components/SectionHeader.tsx`, `web/app/theme.css` (act/leaderboard styles)
- Reference: `docs/design/observatory-preview-template.html` (FORECAST CHART IIFE with the `draw()`/ResizeObserver reflow; `.board`/`.row` leaderboard CSS)

**Interfaces:**
- Consumes: the existing `loadForecast`/`loadMetrics` from `web/lib/contract.ts` (unchanged).
- Produces: `SectionHeader` renders `01 / The forecast / lede`; the chart reflows to container width.

- [ ] **Step 1: Restyle `SectionHeader`** into the act header (mono `actnum`, serif title with the passed `headingId`, one-line lede). Keep the `headingId` prop so `page.tsx`'s `aria-labelledby` still resolves.

- [ ] **Step 2: Remove the stale hero note.** In `ForecastSection.tsx`, delete the `<p className="forecast-hero-note">LightGBM and ensemble metrics are withheld pending a leakage-free re-run - issue #20.</p>` block. Keep the honest best-`final`-model hero (already correct: GradientBoosting 0.27). The `[ HOLDOUT ]` / `[ GLOBAL DAILY MEAN ]` provenance chips stay.

- [ ] **Step 3: Make the chart reflow to container width.** In `ForecastChart.tsx`, replace the fixed `min-width:640px` SVG approach with a container-width render that recomputes geometry on resize. Port the template's `draw(force)` + `ResizeObserver` pattern (measure `svg.getBoundingClientRect().width`, set `viewBox="0 0 W H"`, mobile branch `W<560` with tighter margins, shorter height, `9.5px` axis text, abbreviated end-labels). Keep the existing crosshair/readout hover and the screen-reader table. Keep the draw-in animation gated on first view + `prefers-reduced-motion`.

- [ ] **Step 4: Restyle the leaderboard.** Present the metrics as the ember RMSE-bar leaderboard from the template (`.board`/`.row`, best row tagged), or keep `MetricsTable` and add the bar column - either satisfies the criterion; port the template's `.board` CSS for the bar version. Mobile: rows reflow (name+value one line, bar full-width) per the template's `@media (max-width:560px)` block.

- [ ] **Step 5: Build + redesign check.** Run: `cd web && npm run build && node scripts/check-redesign.mjs` - Expected: build clean; the `#20`/`withheld` assertions move toward passing (they fully pass after Task 8 clears `MethodologyNote`).

- [ ] **Step 6: Browser gate at 360px and 1280px.** Axis labels legible (>= ~9px) at 360px; no horizontal body scroll; hover readout works at desktop.

- [ ] **Step 7: Commit.**

```bash
git add web/components/forecast/ web/components/SectionHeader.tsx web/app/theme.css
git commit -m "feat(web): reflow the forecast chart and drop the stale caveat note"
```

---

## Task 6: The Anomalies act (map restyle + semantic cross-link)

**Files:**
- Modify: `web/components/anomalies/AnomaliesSection.tsx`, `AnomalyMap.tsx`, `SemanticSearch.tsx`, `MethodStrip.tsx`, `RecordsList.tsx`, `web/app/theme.css`
- Reference: `docs/design/observatory-preview-template.html` (metric cards, ticker, and the SEMANTIC SEARCH IIFE with `highlightOnMap`)

**Interfaces:**
- Consumes: `loadAnomalyEmbeddings` and the anomalies contract from `web/lib/contract.ts` (unchanged); the existing `cosine`/`topMatches` logic in `SemanticSearch.tsx` (unchanged algorithm).
- Produces: `AnomalyMap` exposes `highlightRecords(records: EmbeddedAnomalyRecord[])` (via `useImperativeHandle` on a `ref`, or a shared parent state) so `SemanticSearch` can ring the top matches on the real MapLibre map.

- [ ] **Step 1: Lay out the act:** metric trio (`MethodStrip` -> the three `.mcard`s: z-score / iForest / both, the "both" card as the accented hero card), then the map + ticker row, then the semantic search panel. Port the `.metricstrip`/`.mcard` and `.ticker`/`.tkrow` CSS from the template.

- [ ] **Step 2: Restyle `AnomalyMap`** to the Observatory tokens (markers coloured by temperature via the diverging scale, shaped by method) and add the highlight handle:

```tsx
// AnomalyMap.tsx - expose an imperative highlight for the semantic cross-link
export interface AnomalyMapHandle { highlightRecords(records: { lat: number; lon: number }[]): void; }
// inside the component, with a maplibre `map` ref and a dedicated GeoJSON source 'sem-highlights':
useImperativeHandle(ref, () => ({
  highlightRecords(records) {
    const fc = { type: 'FeatureCollection', features: records.map((r, i) => ({
      type: 'Feature', properties: { rank: i + 1 },
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] } })) };
    (map.current?.getSource('sem-highlights') as maplibregl.GeoJSONSource | undefined)?.setData(fc);
  },
}), []);
```

Add a pulsing ember ring layer bound to `sem-highlights` (a circle layer; static under `prefers-reduced-motion`). Keep the existing point markers, hover popups, and the `RecordsList` a11y equivalent.

- [ ] **Step 3: Restyle `SemanticSearch`** into the chips + animated ranked rows (`.semchip`/`.semrow`/`.semscorebar` from the template); keep `TOP_K`, the precomputed query embeddings, and `topMatches` unchanged (offline cosine). On active-query change, call `mapRef.current?.highlightRecords(matches.map(m => m.record))`. Wire the shared `ref` from `AnomaliesSection`.

- [ ] **Step 4: Fold in the "how to read this" aside** (the trimmed `MethodologyNote`) at the end of the act, if kept.

- [ ] **Step 5: Build.** Run: `cd web && npm run build` - Expected: PASS.

- [ ] **Step 6: Browser gate.** Selecting a query re-ranks the rows and rings the top matches on the map; no network request fires after initial load (check the Network panel / `read_network_requests`); map and search are keyboard-reachable.

- [ ] **Step 7: Commit.**

```bash
git add web/components/anomalies/ web/app/theme.css
git commit -m "feat(web): restyle the anomalies act and cross-link semantic search to the map"
```

---

## Task 7: The Drivers act

**Files:**
- Modify: `web/components/drivers/DriversSection.tsx`, `ShapBar.tsx`, `ShapBeeswarm.tsx`, `web/app/theme.css`
- Reference: `docs/design/observatory-preview-template.html` (SHAP IIFE + `.shap`/`.srow`/`.sbar` CSS)

**Interfaces:**
- Consumes: the SHAP contract from `web/lib/contract.ts` (unchanged).
- Produces: the Drivers act with the magnitude-ramp importance bars and the one-line reading.

- [ ] **Step 1: Restyle the SHAP importance bars** to the horizontal `.srow` bars coloured by a cool->warm magnitude ramp (`mix(#3fa9c7, #f2612c, value/max)`), mono values, animated on first view (reduced-motion honoured). Keep the existing beeswarm toggle if present, restyled to tokens. Keep the PM2.5 framing chip (`MODEL: PM2.5 / NOT TEMPERATURE`) - it is honest, not a caveat.

- [ ] **Step 2: Add the one-line reading** ("Humidity and visibility lead; temperature contributes less than most people expect") from the template, no em-dashes.

- [ ] **Step 3: Build + browser gate.** Run: `cd web && npm run build` then eyeball - bars descend humidity(5.06) -> wind kph(0.79), warm-to-cool ramp, correct values.

- [ ] **Step 4: Commit.**

```bash
git add web/components/drivers/ web/app/theme.css
git commit -m "feat(web): restyle the drivers act with the magnitude-ramp shap bars"
```

---

## Task 8: Close section and copy reframe (clears the last stale strings)

**Files:**
- Create: `web/components/CloseSection.tsx`
- Modify: `web/components/DataStatusBanner.tsx`, `web/components/MethodologyNote.tsx`, `web/app/theme.css`
- Reference: `docs/design/observatory-preview-template.html` (`.close`, `.colophon`, `.repro` CSS + markup)

**Interfaces:**
- Consumes: `web/public/data/meta.json` (for the commit + date in the banner and close).
- Produces: `<CloseSection/>` used by `page.tsx`.

- [ ] **Step 1: Reframe `DataStatusBanner`.** For `data_status: "real"`, render `Live model output - commit <sha> - <date>` in the confident (secondary/success) tone, not a warning. Keep the `sample` branch but reword it to a neutral non-apologetic note. Remove the literal `[ SAMPLE DATA ] layout preview - not model output` string for the real state.

- [ ] **Step 2: Trim `MethodologyNote`.** Delete the `PENDING RE-RUN` and `LEAKAGE FIX PENDING - #20` list items and the "metrics were withdrawn ... issue #20" copy. Reduce to a short "how to read this" aside (what the provenance chip and the holdout mean). This removes the last `#20`/`PENDING RE-RUN`/`withheld` occurrences.

- [ ] **Step 3: Build `CloseSection`** - the two reproducibility cards + the role-grouped colophon (crediting Astryx, MapLibre, the model set) + the commit footer, ported from the template's close section.

- [ ] **Step 4: Build + redesign check (now fully green).**

Run: `cd web && npm run build && node scripts/check-redesign.mjs`
Expected: PASS on all three assertions (no forbidden strings, no TabList, contract untouched).

- [ ] **Step 5: Commit.**

```bash
git add web/components/CloseSection.tsx web/components/DataStatusBanner.tsx web/components/MethodologyNote.tsx web/app/theme.css
git commit -m "feat(web): reframe provenance copy and add the reproducibility close"
```

---

## Task 9: Responsive, accessibility, and final verification pass

**Files:**
- Modify: `web/app/theme.css` (the responsive `@media` blocks + reduced-motion; port the template's responsive section verbatim), any component needing a touch-target or focus fix
- Reference: `docs/design/observatory-preview-template.html` (the `/* responsive */` and `@media (prefers-reduced-motion: reduce)` blocks)

**Interfaces:**
- Consumes: everything from Tasks 2-8.

- [ ] **Step 1: Port the responsive rules** (breakpoints at 1024/860/768/640/560; `.wrap` padding, header-chip hide, hero spacing, section padding, metric/colophon/ticker single-column, leaderboard/semantic row reflow) into `theme.css`, adapted to the real class names used by the components.

- [ ] **Step 2: Accessibility sweep.** Keep the global 2px accent focus ring; ensure every new interactive control (semantic chips, theme toggle, legend, map controls) is keyboard-reachable with a visible ring; keep >= 44px touch targets; confirm each chart keeps its table/text equivalent; confirm `prefers-reduced-motion` disables the stripes, reveals, chart draw-in, and map ring pulse.

- [ ] **Step 3: Full gate.**

Run: `cd web && npm run build && node scripts/check-redesign.mjs`
Expected: build clean, check passes.

- [ ] **Step 4: Browser verification at 320 / 360 / 768 / 1280 / 1536.** Confirm: no horizontal body scroll at any width; chart labels legible on mobile; theme toggle works in both directions; deep-link anchors work; semantic search ranks + highlights offline. Capture a desktop and a mobile screenshot for the PR Evidence section.

- [ ] **Step 5: Update docs.** Refresh any screenshots or section names in `web/DEPLOY.md` / `README.md` that the redesign changed. Do not restate ADRs; link them.

- [ ] **Step 6: Commit.**

```bash
git add web/app/theme.css web/DEPLOY.md README.md
git commit -m "feat(web): finalize responsive and accessibility for the observatory redesign"
```

---

## Self-Review (against SPEC 0031)

**Spec coverage:**
- New identity / tokens / DESIGN.md -> Tasks 1, 2. Serif type via next/font (ADR-H) -> Task 2.
- Single-scroll IA replacing TabList, hash anchors (ADR-G) -> Task 3.
- Hero + warming-stripes -> Task 4.
- Forecast act, responsive chart -> Task 5. Anomalies act + semantic cross-link -> Task 6. Drivers act -> Task 7. Close + colophon -> Task 8.
- Copy reframe / remove stale #20+sample caveats -> Tasks 5 (hero note) + 8 (banner, methodology); asserted by the check in Tasks 1/3/5/8.
- Responsive + a11y + reduced-motion -> Task 9 (and per-task browser gates).
- Contract untouched (ADR-D) -> enforced by `check-redesign.mjs` every task.
- Every acceptance criterion maps to a gate: build (all), forbidden-strings + no-TabList + contract (`check-redesign.mjs`), palette/contrast (Task 2 validator), reflow/legibility + keyboard + reduced-motion (browser gates in Tasks 5/6/9).

**Placeholder scan:** no TBD/TODO; the one deferred decision (exact serif face) is a named default (Fraunces) with an owner-swap note in the spec, not a gap.

**Type consistency:** `highlightRecords` is defined once (Task 6) and consumed by `SemanticSearch` in the same task; `SectionHeader`'s `headingId` prop is preserved (Tasks 3, 5) so `aria-labelledby` resolves; the `--font-display` variable name is unchanged, only its face changes (Task 2), so `theme.css`'s `--font-family-heading: var(--font-display)` keeps working.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-observatory-visual-redesign.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
