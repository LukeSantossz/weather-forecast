# SPEC: feat(web): redesign the dashboard with the "Observatory" identity and a scrollytelling narrative

Full-tier spec. This change replaces the locked "instrument console" design language
(`.ulpi/design/DESIGN.md`) and restructures the dashboard's information architecture, so it
carries real trade-offs recorded as ADR candidates below. The visual direction was validated
with an interactive Claude Design preview running on the real `2026-07-05` pipeline output and
approved by the owner before this spec. It keeps the Python pipeline, the JSON data contract, and
the Astryx component library unchanged; the identity is applied by re-theming, not rebuilding.

## Problem

The dashboard presents strong ML results weakly for a machine-learning hiring skim: the copy is
caveat-forward and now stale (a persistent `[ SAMPLE DATA ] not model output` banner, a
`[ LEAKAGE FIX PENDING - #20 ]` note, and "LightGBM and ensemble metrics are withheld pending a
leakage-free re-run" all still render even though `meta.json` is `data_status: "real"`, issue #20
is resolved, and every row in `metrics.json` is `status: "final"`), the three flat tabs read as a
tool rather than a narrative, and the graphite-plus-amber "console" identity reads as
generic-technical instead of as a confident, communicative data-journalism story.

## Design Decision

Re-theme the existing Astryx dashboard into a new locked identity, "Observatory" (a warm-ink
ground, a single ember accent, a serif-display and mono-data type pairing, with the Ed-Hawkins
warming-stripes as the recurring signature), and restructure the three tabs into one
scrollytelling narrative with the charts as the hero: a thesis hero, then three annotated acts
(Forecast, Anomalies, Drivers), then a reproducibility close. Rewrite the copy so the project's
honesty reads as engineering rigor rather than apology, deleting the stale #20 and sample caveats
now that the committed data is real and final. The React app, the Python-owned data contract
(`web/public/data/*` and its schemas), and the Astryx components stay as they are; the identity is
applied by overriding Astryx's CSS-variable tokens (the ADR-B convention from SPEC 0006) plus the
existing bespoke dataviz layer (charts via d3, the MapLibre anomaly map, the SHAP bars) and the
existing offline semantic search, which is restyled into the Anomalies act and cross-linked so its
top matches highlight on the map. `.ulpi/design/DESIGN.md` is rewritten to the Observatory identity
as the new locked source of truth.

## Architecture Decisions

Promoted to `docs/adr/` at the Spec Gate (`0002-observatory-identity.md`,
`0003-single-scroll-narrative.md`, `0004-nextfont-typography.md`); each is hard to reverse or
supersedes a prior locked decision. Summarised here.

- **ADR-F. Replace the "instrument console" identity with "Observatory."** Supersedes the
  `DESIGN.md` lock and the presentation half of SPEC 0006. Rationale: for an ML-hiring skim, a
  data-journalism identity signals the core skill (turning a model into insight) better than a
  generic-technical console. Preserves SPEC 0006's ADR-D (Python owns the contract) and ADR-E
  (honesty lives in the data) unchanged.
- **ADR-G. Single-scroll narrative replaces the tab IA.** `app/page.tsx` moves from
  `TabList`/`Tab` to one scrolling page of sections. Deep-linkable per act via hash anchors so no
  addressability is lost. Rationale: a guided story with charts-as-hero beats flat tabs for a
  skim; the tabs' depth is preserved as acts, not discarded.
- **ADR-H. Production typography via `next/font` self-hosted.** A serif display face, a grotesk
  body face, and IBM Plex Mono for data, replacing the `DESIGN.md` Archivo/Hanken pairing. No
  runtime CDN, metric-matched fallbacks. Face choices are swappable; the three roles are fixed.

## Sections (the narrative, owner-confirmed framing preserved)

Section framing from SPEC 0006 is unchanged (global daily-mean temperature signal, air-quality
SHAP, point-marker anomaly map); only presentation changes.

1. **Hero.** Thesis headline plus a hero-stat row (best-model RMSE, countries scored, holdout
   length, models benchmarked) over an animated warming-stripes backdrop built from the real
   temperature series. Provenance appears as a confident `Live model output - commit - date` chip,
   not a caveat.
2. **Act 01, The forecast.** An annotated observed-vs-forecast line chart (history plus the 30-day
   holdout with the ensemble prediction overlaid, a shaded holdout band, a hover crosshair and
   tooltip), then the model leaderboard (holdout RMSE bars, ensemble weights).
3. **Act 02, The anomalies.** The method metric trio (z-score / isolation-forest / both), the
   MapLibre basemap with anomaly point markers (colour = temperature, shape = method) and hover,
   the "most extreme" ticker, and the semantic search (example-query chips, offline cosine over the
   precomputed MiniLM embeddings, animated ranked results) cross-linked so the top matches ring on
   the map above.
4. **Act 03, The drivers.** The PM2.5 SHAP mean-absolute-importance bars (a magnitude colour ramp)
   with a one-line plain-language reading.
5. **Close.** Reproducibility framed as a strength, an engineering colophon grouped by role (which
   credits the stack including Astryx), and a commit-stamped footer.

## Visual identity (new tokens, applied over Astryx)

Recorded in full in the rewritten `DESIGN.md`; summarised here.

- **Colour.** Warm-ink neutrals (dark primary ground near `#141210`, light re-derived near
  `#f7f6f3`, not cream), a single ember accent (`#f2612c`, light-tuned `#d8511c`), a glacier-cyan
  cool pole (`#3fa9c7`) that anchors the physically-real diverging temperature scale, plus the
  existing semantic states. Distribution stays roughly 60-30-10.
- **Type.** Serif display (candidate: Fraunces or Newsreader), grotesk body (candidate: Hanken
  Grotesk, retained), IBM Plex Mono for every number, tick, and provenance chip. Serif-display and
  mono-data is the data-journalism pairing and is deliberately distinct from the all-grotesk
  console.
- **Signature.** Warming-stripes (hero backdrop and section motif) and the provenance chips,
  reframed as confidence cues.
- **Structure.** The `DESIGN.md` spacing, radius, motion, and accessibility scales are retained;
  motion is one orchestrated hero reveal plus per-section scroll reveals and a first-view chart
  draw-in, all honouring `prefers-reduced-motion`.

## Copy reframe

- `DataStatusBanner` renders a confident `Live model output - commit - date` line for the `real`
  state; the `sample` state is retained (honesty-in-data, ADR-E) but is not the default text.
- Remove the stale withdrawn-metrics copy: the `ForecastSection` hero note, and the
  `[ PENDING RE-RUN ]` / `[ LEAKAGE FIX PENDING - #20 ]` items in `MethodologyNote`, are deleted or
  repurposed now that all metrics are `final`. `MethodologyNote` becomes a short "how to read this"
  aside rather than a caveat list.
- Reproducibility becomes the closing argument (every figure regenerates from the contract;
  datasets are commit-stamped), not an apology. No em-dashes in UI copy (house preference).

## Scope

- **Includes:** a new Astryx token theme plus a rewritten `.ulpi/design/DESIGN.md`; the
  single-scroll `app/page.tsx` IA with per-act hash anchors (replacing `TabList`); the hero with
  the warming-stripes backdrop and hero stats; restyling the Forecast, Anomalies, and Drivers
  sections into annotated acts; the copy rewrite that removes the stale #20/sample caveats;
  restyling the existing `SemanticSearch` and adding the map cross-link; container-width responsive
  charts (reflow on resize) and the mobile layout rules; retaining and restyling the MapLibre
  basemap; scroll-reveal and chart draw-in motion with reduced-motion honoured; production
  typography via `next/font`; accessibility (keyboard path, visible focus, table/text chart
  equivalents, WCAG AA contrast for the new tokens); updating `web/DEPLOY.md`/README references if
  screenshots or section names change.
- **Does NOT include:** any change to the Python pipeline, the data contract, or the JSON schemas
  (`ADR-D` holds: swapping data still changes zero front data lines); live inference or any backend
  (phase 2); a new component library (no shadcn; Astryx stays, owner-confirmed); any new heavy
  front-end dependency beyond the already-present Astryx, MapLibre, and d3; re-running or altering
  the committed data; per-country forecasting; changing the semantic-search algorithm, the
  embeddings, or the model set.

## Acceptance Criteria

Phrased as verifiable outcomes; each becomes a check or test in the Plan.

- `build_exports_static_with_no_console_errors`: `cd web && npm run build` (`output: 'export'`)
  succeeds and `web/out/` serves with zero console errors in both light and dark themes.
- `no_stale_caveat_copy_when_data_is_real`: with `data_status: "real"` and all metrics `final`, the
  rendered output contains none of `SAMPLE DATA`, `PENDING RE-RUN`, `withheld`, or `#20` (asserted
  by a test over the built HTML / component render).
- `contract_swap_changes_zero_front_data_lines`: replacing `web/public/data/*` with a fresh export
  changes no `.tsx`/`.ts` file under `web/` (ADR-D preserved).
- `page_is_one_scroll_narrative_with_working_anchors`: `page.tsx` renders no `TabList`; each act is
  reachable by its `#forecast` / `#anomalies` / `#drivers` hash and scrolls into view.
- `semantic_search_ranks_and_highlights_offline`: selecting an example query re-ranks records by
  cosine similarity and highlights the top matches on the map, with no network request after load.
- `charts_reflow_and_stay_legible_on_mobile`: at a 360px viewport the forecast chart reflows to
  container width with axis labels at or above roughly 9px, and the page body does not scroll
  horizontally at any breakpoint from 320px to 1536px.
- `new_tokens_pass_contrast_and_palette_validation`: the Observatory palette passes the dataviz
  palette validator in light and dark, and each text pairing meets WCAG AA (4.5:1 body, 3:1 large
  and UI/chart strokes), verified in code.
- `keyboard_and_reduced_motion_paths_hold`: every interactive control is keyboard-reachable with a
  visible focus ring; `prefers-reduced-motion` disables the reveal, stripe, and draw-in animations;
  charts retain a table or text equivalent.
- Existing web checks pass; `.ulpi/design/DESIGN.md` is updated to the Observatory identity.

## Reproducibility

- Front: `cd web && npm ci && npm run build`, then `npx serve out` (Node LTS; exact deps via the
  committed lockfile). Responsiveness checked from 320px to 1536px.
- Data: unchanged. `python -m src.dashboard_export --out web/public/data` regenerates the identical
  contract; no seed or model change.
- Design reference: the approved Claude Design preview (artifact
  `32eb6d00-3bc9-40fc-bc10-8cc41dccc245`) and the source mockup used to validate the look, copy, and
  interaction on the `2026-07-05` output.

## Risks and Assumptions

- Assumption: Astryx's CSS-variable token overrides can express the Observatory palette and type
  without re-implementing components (consistent with SPEC 0006 ADR-B and the current theme
  override). If a specific component resists theming, the fallback is a thin CSS wrapper for that
  one component, not a new library.
- Assumption: the serif display face renders acceptably self-hosted via `next/font`; if the chosen
  face reads as generic or clashes, swap the face (the three type roles are fixed, the face is a
  build detail, owner sign-off on the face like the original Astryx theme sign-off).
- Risk: the single-scroll IA changes deep-linking; mitigated by keeping per-act hash anchors and
  scroll-into-view (ADR-G).
- Risk: the MapLibre basemap must stay static-export and client-side-render safe; it already is in
  the shipped app, so this is a restyle, not a re-integration.
- Assumption: #20 is resolved and the committed data is `real` and `final` (verified in
  `meta.json` and `metrics.json`, generated `2026-07-05`), so removing the caveats is correct; if a
  future run is dirty, the honesty-in-data mechanism (ADR-E: `data_status`, `status: pending_rerun`)
  re-surfaces the caveats without a code change.
- This spec supersedes the `DESIGN.md` "instrument console" lock and the presentation half of SPEC
  0006, and preserves SPEC 0006 ADR-D and ADR-E.

## Alternatives Considered

- **Evolve the console identity in place** (reframe the copy and polish the layout, keep the
  graphite-plus-amber look). Rejected: the owner chose a fresh identity, and the console reads as
  generic-technical for the hiring-skim goal.
- **Add a narrative layer on top of the existing tabs** (a new landing above the tab dashboard).
  Rejected: two information architectures to maintain; the single narrative is cleaner and keeps the
  tabs' content as acts.
- **Switch the component foundation to shadcn/ui.** Rejected: two component systems in one app for
  little gain, since most of this design's surface is bespoke dataviz that no library ships, and
  Astryx is the portfolio's design-system talking point (owner confirmed keeping Astryx).
