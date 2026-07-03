# Visual Dashboard Phase 2 — Front Build Implementation Plan

> **For agentic workers:** implement task-by-task; each task is executed on this branch through the repo
> framework gates (TDD/verify where testable → R1 → R2 Codex → R3 CodeRabbit → the static-export build gate).
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the three-section static dashboard (Forecast / Anomalies / Drivers) on the Plan-1
foundation, implementing `.ulpi/design/dashboard-phase1.md` exactly and rendering the committed data
contract.

**Architecture:** Next.js `output:'export'` app in `web/`, Astryx components themed with our DESIGN.md
tokens, custom chart layer, MapLibre lazy-loaded on the Anomalies tab. The front only renders the
JSON contract; it never derives data.

**Tech Stack:** Next.js 16 (static export), React 19, Astryx `@astryxdesign/core` `0.1.2` (pre-compiled
CSS + Theme provider), next/font (Cabinet Grotesk, General Sans, IBM Plex Mono), a client-side chart lib
(pick per the dataviz spec; must be CSR-safe and within budget), MapLibre GL (lazy).

## Global Constraints (verbatim from DESIGN.md + SPEC 0006)

- Astryx pinned `0.1.2`; imports only in `web/components/`. Pull EXACT props per component from the
  archived manifest: `cd web && node node_modules/@astryxdesign/cli/bin/astryx.mjs --json component <Name>` — never guess.
- Bind every visual value to `.ulpi/design/DESIGN.md` tokens (one amber accent, one radius scale, the three
  fonts, precision-tick + provenance-chip signature). No off-system values.
- Honesty: render `data_status` (sample badge) and per-row `status` (`pending_rerun` badge) as first-class;
  the value 0.19 must never appear. Framing verbatim: "global daily mean" (not per-country), SHAP target
  "PM2.5 · not temperature".
- Static export only; every chart/map is CSR-safe (guard browser APIs behind a client mount) and has a
  text/table equivalent; no series/method distinguished by color alone; honor `prefers-reduced-motion`.
- Copy bans (anti-slop): no buzzwords, no em-dash in UI copy, mono for numbers.

---

### Task 1: Theme + app shell (the "show it early" milestone) — Sonnet, then owner visual check

**Files:** `web/app/theme.css` (token overrides), `web/app/fonts.ts` (next/font), `web/app/layout.tsx`
(Theme provider + fonts + banner + footer), `web/components/{SectionHeader,DataStatusBanner,ThemeToggle}.tsx`,
`web/app/page.tsx` (Tabs shell).

- [ ] Query the manifest for the Theme provider + Tabs + Badge + Text setup (`astryx ... component Tabs`, `Theme`, `Badge`, `Text`).
- [ ] Self-host the three fonts via `next/font/local` (or google where licensed); expose CSS vars.
- [ ] Write `web/app/theme.css`: map DESIGN.md tokens onto Astryx's CSS variables (color roles, accent, fonts, radius) for light + dark; layered AFTER `astryx.css` + `theme-neutral`.
- [ ] Wire `layout.tsx`: Astryx Theme provider (`neutralTheme`) + link provider; import CSS in order; render header (mark + tick line), `DataStatusBanner` (reads `meta.json` `data_status`), and the provenance footer.
- [ ] `page.tsx`: Astryx `Tabs` — Forecast / Anomalies / Drivers, deep-linkable `#hash`, keyboard-navigable; each panel a placeholder for now.
- [ ] `ThemeToggle`: persists to localStorage, defaults to `prefers-color-scheme`, sets the Astryx dark/light mechanism (from the manifest).
- [ ] Verify: `npm run build` (type-checked) passes; serve `out/`, screenshot light + dark. **STOP for owner visual sign-off on the shell before building sections.**
- [ ] Commit per coherent step.

### Task 2: Data layer + honesty components — Sonnet

**Files:** `web/lib/contract.ts` (TS types mirroring the 5 schemas + a typed loader), `web/components/{ProvenanceChip,StatBlock}.tsx`, `web/lib/contract.test.ts` (or a light runtime assert).

**Interfaces produced:** `type Meta/Forecast/Metrics/Anomalies/Shap`; `loadSection<T>(name): Promise<T>` reading `/data/<name>.json`; `<ProvenanceChip tone label />`, `<StatBlock value unit label chips emphasis? />`.

- [ ] Hand-write TS types mirroring `web/public/data/schema/*.schema.json` (no codegen). Keep them the single front-side truth.
- [ ] `loadSection` fetches the committed JSON at runtime (static-safe: `fetch('/data/...json')` from a client component, or import at build). Handle missing/parse error → typed error.
- [ ] `ProvenanceChip` (Astryx Badge base, IBM Plex Mono, tone→DESIGN semantic color) + `StatBlock`. a11y: real text, tooltip for long meaning.
- [ ] Verify build; render a chip gallery in a scratch route to eyeball tones. Commit.

### Task 3: Forecast section — Opus (chart) + Sonnet (table)

**Files:** `web/components/forecast/{ForecastSection,ForecastChart,MetricsTable}.tsx`.

- [ ] `MetricsTable` (Astryx Table from manifest): columns per spec; `pending_rerun` rows show `—` + a `PENDING RE-RUN` chip + tooltip (#20); best `final` row accent-emphasized; mono right-aligned numbers.
- [ ] `ForecastChart` (chart lib): history/actual/model series per DESIGN dataviz palette (Ensemble = amber hero), precision-tick axes, direct end-labels, crosshair mono readout, keyboard-operable legend; accessible table equivalent = MetricsTable + visually-hidden series table.
- [ ] `StatBlock` hero: best `final` model value + `HOLDOUT` + `GLOBAL DAILY MEAN` chips; if the marketed models are pending, show the honesty state, never 0.19.
- [ ] Verify build + light/dark screenshot; confirm no 0.19 in the DOM. Commit.

### Task 4: Anomalies section — Opus (map) + Sonnet (strip/list)

**Files:** `web/components/anomalies/{AnomaliesSection,AnomalyMap,MethodStrip,RecordsList}.tsx`.

- [ ] `MethodStrip`: 3 `StatBlock`s (z-score 930/0.70%, iforest 2667/2.00%, overlap 219 in danger tone).
- [ ] `AnomalyMap`: MapLibre GL, **lazy-loaded on this tab only** (dynamic import, client-mount guarded); themed graphite style + free tile/style source; point markers colored by `detected_by` (cyan/violet/danger); hover mono tooltip; legend filters by method; reduced-motion → no fly-to. NOT a choropleth.
- [ ] `RecordsList` (Astryx List): top anomalies, mono values, click → pan/highlight the marker; this is the map's accessible equivalent.
- [ ] Verify build + screenshot; confirm MapLibre does not load on the other tabs. Commit.

### Task 5: Drivers (SHAP) section — Sonnet

**Files:** `web/components/drivers/{DriversSection,ShapBar,ShapBeeswarm}.tsx`.

- [ ] Section title + `MODEL: PM2.5 · NOT TEMPERATURE` chip.
- [ ] `ShapBar`: horizontal bars of `mean_abs_shap`, sorted, mono labels, amber sequential ramp.
- [ ] `ShapBeeswarm`: per-feature points, x = SHAP (diverging amber↔cyan), color = normalized value; one-line plain reading above; mobile fallback = bar only.
- [ ] Verify build + screenshot. Commit.

### Task 6: A11y + deploy — Opus (a11y adjudication) + Sonnet (config)

**Files:** `web/vercel.json` (or Vercel project settings note), a11y fixes across components.

- [ ] Full keyboard path; focus ring (accent, 2px, 2px offset); every chart has its text/table equivalent; contrast verified light+dark for each pairing (esp. amber, chip tones); touch targets ≥44px.
- [ ] Reduced-motion verified (draw-ins/reveals become instant).
- [ ] Vercel static deploy config for `web/` (output `out/`); document the deploy step.
- [ ] Final `npm run build` gate; full-site screenshot pass in both themes. Commit.

## Deferred / gated

- Real data (`data_status:"real"`, real numbers) is **phase 1.5** — triggered by #20 merged + owner-supplied
  data; a one-command re-export, no `web/` change.
- Public URL goes live only AFTER #19 (README retraction) merges, so the site and README do not contradict.

## Self-Review

- Spec coverage: shell (§App shell) ✓; data layer + honesty (ADR-D/E, ProvenanceChip) ✓; 3 sections + charts ✓;
  a11y + deploy ✓. Real-data + public-URL correctly deferred.
- Placeholder note: exact Astryx props are pulled from the manifest per task (authoritative), not guessed.
- Type consistency: `loadSection`, the five contract types, and the component props are referenced consistently across tasks.
