# dashboard-phase1.md — Feature spec (binds to DESIGN.md)

Phase-1 static results dashboard. Binds to `.ulpi/design/DESIGN.md` (Meteorological Instrument Console).
All visual values reference DESIGN.md tokens; nothing new is invented here. Data comes from the
committed JSON contract (`web/public/data/*.json`, SPEC 0006). Astryx components are themed, not redesigned.

## App shell & layout

- **Frame:** a fixed top **console header** (Astryx-themed) + a persistent **DataStatusBanner** + the
  section body + a **provenance footer**. Container max 1200, generous side gutters.
- **Header:** left = product mark "WEATHER · FORECAST CONSOLE" in Cabinet Grotesk over a precision-tick
  line; right = ThemeToggle (light/dark) + a link to the repo/README methodology.
- **DataStatusBanner:** full-width, one line, IBM Plex Mono. When `data_status:"sample"` it reads
  `[ SAMPLE DATA ] layout preview · not model output — see methodology` in the warning/pending color.
  When `real` it reads `[ REAL ] generated <date> · commit <sha>` in the muted color. First-class, never hidden.
- **Navigation:** Astryx **Tabs** — `Forecast` · `Anomalies` · `Drivers`. Tabs are the tour. Deep-linkable
  (`#forecast|#anomalies|#drivers`). Keyboard-navigable (Astryx handles roving tabindex; verify).
- **Footer:** provenance — pipeline source (`notebooks 04/06/07`), `schema_version`, generated timestamp,
  and an honest one-liner: "Global daily-mean model built from 211 countries' data."

## User flow & states

Primary journey: land on **Forecast** (the strongest ML story) → skim hero stat + chart → optionally open
Anomalies (map) → Drivers (SHAP). A recruiter gets the story in the first viewport of Forecast.

| state | trigger | treatment |
|---|---|---|
| initial load | first paint before JSON resolves | skeletons (Astryx Skeleton) sized to the real content; no layout shift |
| loaded | JSON fetched + schema-valid | render; one orchestrated reveal per section; charts draw in on first view |
| partial | a section's rows are `pending_rerun` | render values as `— pending` with a `[ PENDING RE-RUN ]` chip; never blank silently |
| empty | a data file missing/empty | inline EmptyState: "No data for this section." + methodology link; other tabs still work |
| error | fetch/parse fails | inline error panel with the failing file name + a retry; never a blank screen |
| reduced-motion | OS setting | draw-in and reveals become instant; no bounce anywhere |

## Section 1 — Global temperature forecast (`#forecast`)

Layout (desktop): a **StatBlock** hero row, then the **ForecastChart** full-width, then the **MetricsTable**.
Mobile: stacked, chart scrolls horizontally inside its own container (page never scrolls horizontally).

- **StatBlock (hero):** the headline model result as a large IBM Plex Mono tabular number with unit and a
  provenance chip. If the best `final` model is the display value, show e.g. `0.__ °C RMSE` + `[ HOLDOUT ]`
  + `[ GLOBAL DAILY MEAN ]`. If the ensemble/LightGBM (the marketed numbers) are `pending_rerun`, the hero
  shows the best *final* statistical model instead and a `[ LEAKAGE FIX PENDING · #20 ]` chip — honesty over
  hype. Subtext (General Sans): "Daily-mean temperature across 211 countries · 30-day holdout."
- **ForecastChart:** x = date; y = °C. Series per DESIGN dataviz palette: `actual` (thick neutral),
  `history` (thin muted, the training tail for context), and model `predictions` (Ensemble = amber hero;
  others = categorical). Axes use precision ticks; direct end-labels on lines (no legend-only). Hover: a
  crosshair + a mono readout of date/value/series. Toggle series via the legend (keyboard-operable).
  Accessible equivalent = the MetricsTable + a visually-hidden data table.
- **MetricsTable (Astryx Table, themed):** columns Model · RMSE °C · MAE °C · MAPE % · Ensemble weight ·
  Status. `final` rows show values; `pending_rerun` rows show `—` + a `[ PENDING RE-RUN ]` chip and a
  tooltip "withdrawn pending evaluation-leakage fix (#20)". Best `final` row emphasized (accent left-border).
  Numbers are mono, right-aligned, tabular.

## Section 2 — Anomaly explorer (`#anomalies`)

Layout: a **method stat-strip** across the top, then the **AnomalyMap** (dominant), with a **records
side-panel** (list) on wide screens / below on mobile.

- **Stat-strip (3 StatBlocks):** Z-score `930 · 0.70%`, Isolation Forest `2667 · 2.00%`, Overlap `219`
  (the agreed, strongest). Overlap uses the danger color to signal "both methods agree."
- **AnomalyMap (MapLibre, custom):** a dark/light map style matching the theme, **point markers** at real
  lat/lon, colored by `detected_by` (z-score = info-cyan, isolation-forest = violet, both = danger).
  Size/opacity by |z| or if_score. Free tile/style source (MapLibre demo style / CARTO / protomaps — pick
  the free one that themes to graphite). Hover marker → mono tooltip (country, ts, temp_c, z, if_score).
  Legend = the three methods with counts; clicking a legend method filters markers. NOT a choropleth
  (points are points, not country aggregates). Reduced-motion: no fly-to animation.
- **Records side-panel:** a scannable list (Astryx List) of the top anomalies, mono values, each linking to
  its map marker (click → pan+highlight). This is the map's accessible equivalent.

## Section 3 — Environmental drivers · SHAP (`#drivers`)

Honesty-forward: the section title reads **"What drives air-quality (PM2.5) predictions"** with a
`[ MODEL: PM2.5 · NOT TEMPERATURE ]` chip, so no one mistakes it for the forecaster.

- **ShapBar:** horizontal bars of `mean_abs_shap` per feature, sorted desc, mono values, single-hue
  sequential (amber ramp) since it is magnitude. Direct value labels.
- **ShapBeeswarm:** per-feature rows of downsampled points; x = SHAP value (diverging amber↔cyan =
  pushes-up↔pushes-down), color = normalized feature value (same diverging scale). A one-line plain-language
  reading above it: "Higher humidity pushes predicted PM2.5 up." Legend explains the axes in words.
- Fallback if beeswarm is heavy on mobile: collapse to the bar only, with a "show detail" toggle.

## Component specs (all themed on Astryx + bound to DESIGN.md)

- **ProvenanceChip** (signature): props `{ label, tone: sample|pending|final|holdout|info }`. IBM Plex Mono,
  uppercase, bordered, tone → DESIGN semantic color. Astryx Badge base. a11y: text is real (not color-only);
  tooltip for the long meaning. Used everywhere a number has provenance.
- **StatBlock:** props `{ value, unit, label, chips[], emphasis? }`. Mono tabular value; General Sans label;
  chips row. Emphasis adds an accent left-border. States: value | `— pending` | `n/a`.
- **SectionHeader:** Cabinet Grotesk title above a precision-tick line; optional right-aligned chip.
- **DataStatusBanner / ThemeToggle / EmptyState / ErrorPanel / Skeleton:** Astryx-themed; behaviors per the
  state table. ThemeToggle persists choice (localStorage) and defaults to `prefers-color-scheme`.
- **ForecastChart / AnomalyMap / ShapBar / ShapBeeswarm:** custom (chart layer). Each: responsive, CSR-safe
  (no SSR-only browser API at prerender — guard MapLibre/canvas behind a client mount), keyboard-reachable
  controls, a text/table equivalent, honors reduced-motion, ≤ the bundle budget in DESIGN (charts ~150KB gz
  total excluding MapLibre; MapLibre lazy-loaded only on the Anomalies tab).

## Accessibility (feature-level)

- Tab order: header → tabs → active section controls → footer. Visible focus ring (accent, 2px, 2px offset).
- Charts: each has an accessible table/text equivalent; series never distinguished by color alone.
- Contrast: verify every pairing (esp. amber on surfaces, chip tones) against DESIGN guarantees in code.
- Map: keyboard users get the records list as the equivalent; markers have accessible names.

## Build handoff

- **Target agent:** `nextjs-senior-engineer` (Next.js App Router, static export — matches the spike scaffold).
- **Design system:** Astryx `0.1.2` pre-compiled CSS. **Setup note:** override Astryx's color/type CSS-variable
  tokens with DESIGN.md values (a `web/app/theme.css` layered after Astryx's `astryx.css` + `theme-neutral`);
  self-host Cabinet Grotesk / General Sans / IBM Plex Mono via `next/font`; pull exact component props from
  `docs/specs/astryx-manifest-0.1.2.json` (never guess). Charts + MapLibre are custom; MapLibre lazy-loaded.
- **Data:** read `web/public/data/*.json` (SPEC 0006 contract); render the honesty states verbatim; the
  retracted 0.19 must never appear.
- **Instruction:** *Implement exactly this spec. Theme Astryx with our locked tokens; do NOT redesign or
  re-implement its components.* This corresponds to Plan 2 (front build), written after this sign-off.
- **Acceptance criteria:** (1) all 3 sections render from the sample JSON with the correct honesty chips;
  (2) light+dark both pass contrast; (3) `next build` static export succeeds, zero console errors; (4) every
  chart has a text/table equivalent; (5) no value/series distinguished by color alone; (6) MapLibre only
  loads on the Anomalies tab; (7) nothing drifts from DESIGN.md.
