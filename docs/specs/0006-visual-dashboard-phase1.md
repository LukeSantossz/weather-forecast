# SPEC 0006 — feat(web): phase-1 static results dashboard (Astryx + Next.js)

Full-tier spec: this change carries real, hard-to-reverse trade-offs (new front-end
stack in a Python repo, a Python→front data contract), recorded as ADRs below.
Design confirmed by the Fable architecture review (2026-07-03).

## Problem

The project's ML results (forecasting, anomaly detection, SHAP) exist only as
Jupyter notebook cell outputs. There is no way for a recruiter or reviewer to
see the work without running notebooks. Phase 1 delivers a static, hosted,
interactive dashboard that presents those results clearly and honestly — the
first phase of a phased visual layer (phase 2, deferred: live inference).

## Design Decision

A static **Next.js (`output: 'export'`) app under `web/`, styled with Meta's
Astryx design system via its pre-compiled-CSS path**, deployed free on Vercel.
It renders a three-section tour — Forecasting, Anomalies, Environmental drivers
(SHAP) — reading a JSON **data contract** produced by a tested Python export
module in `src/`. Phase 1 ships against a committed, clearly-labeled **sample**
snapshot; swapping in real data is a one-command re-run that changes zero front
lines. Live model inference is out of scope (phase 2).

The pre-compiled-CSS path is the pivotal correction from the architecture review:
it keeps the StyleX compiler out of our build, removing the main integration risk
against Next.js static export.

## Architecture Decisions (ADRs)

- **ADR-A — Static export.** Next.js `output: 'export'` (fully static), root `web/`,
  deployed on Vercel free tier. Portable to GitHub Pages if needed. Phase-2
  inference is an external API the static site fetches client-side; static export
  forecloses nothing.
- **ADR-B — Astryx via pre-compiled CSS, exact-pinned `0.1.2`** (no `^`), lockfile
  committed. The StyleX compiler stays out of our build. Convention: Astryx imports
  live only in `web/components/`, never in page/data logic. The Astryx CLI manifest /
  MCP server is the authoritative source for component APIs — build agents consult it,
  never training-data guesses (Astryx is post the assistant's training cutoff).
- **ADR-C — `web/` subdirectory in this repo** (not a separate repo). The contract's
  two sides (Python writer, TS reader) move atomically; one repo = one portfolio link
  showing ML + front together; CI validates sample-vs-schema without cross-repo sync.
  Mitigation for the mixed toolchain: path-scoped CI jobs.
- **ADR-D — Python owns the data contract.** A tested export module in `src/` writes
  the JSON; JSON Schema files are committed; `web/` holds hand-written mirrored TS
  types (no codegen at this size). The front never derives data; it renders the
  contract. Acceptance: swapping sample→real data changes zero lines in `web/`.
- **ADR-E — Honesty lives in the data, not only the UI.** Every JSON file carries
  `data_status: "sample" | "real"`; every metric row carries
  `status: "final" | "pending_rerun"`. The retracted 0.19 °C value never appears in
  any committed artifact.

## Sections (owner-confirmed framing)

1. **Global temperature forecast.** The model forecasts a **global daily-mean**
   temperature series (verified: `notebooks/06` does `groupby("date")[...].mean()`),
   built from 211 countries' data — framed as a global signal, NOT per-country
   forecasts. Shows history + 30-day test window (actual vs. model predictions) and
   the metrics table.
2. **Anomaly explorer.** A **MapLibre** map with **point markers** at the real
   anomaly lat/lon locations (owner-chosen over the lighter SVG option), colored by
   detection method (z-score / isolation-forest / both), plus the method summary
   (930 / 2667 / 219 overlap). Point markers, not a choropleth — anomalies are
   points, not country aggregates. Requires a free tile/style source (e.g. MapLibre
   demo style / CARTO / protomaps).
3. **Environmental drivers (SHAP).** Explains the **PM2.5 air-quality** model
   (verified: `notebooks/07`, "Feature Impact on PM2.5 Prediction") — labeled as
   air-quality drivers, never "temperature SHAP". Feature-importance bar + beeswarm.

## Data Contract (first cut, `web/public/data/`)

One file per section, each with `schema_version`, `generated_at`, `data_status`.
JSON Schemas committed under `web/public/data/schema/`.

- `meta.json` — schema version, generation time, pipeline commit, disclaimer.
- `forecast.json` — `series.granularity: "daily_global_mean"`, unit celsius,
  `history[]`, `actual[]` (30-pt test window), `models[]` with `predictions[]`.
- `metrics.json` — `models[]` each with `rmse_c/mae_c/mape_pct/ensemble_weight` and
  `status: "final" | "pending_rerun"`. Prophet/ARIMA/SARIMA = final; LightGBM/GB/
  ensemble = pending_rerun with a note referencing #20 and null metrics.
- `anomalies.json` — method summary + `records[]` (`ts, country, lat, lon, temp_c,
  z, if_score, detected_by`). Cap ≈1.5k: all 219 "both" + top-N by |z| / if_score.
- `shap.json` — `model: "lightgbm", target: "pm2_5"`, `features[]` (mean_abs_shap),
  `beeswarm[]` downsampled ≤200 points/feature.

## Scope

- **Includes:** the `web/` static Next.js + Astryx app (3 sections); the Python
  export module (TDD) + committed JSON Schemas; a committed labeled sample snapshot;
  honesty states (`sample` badge, `pending_rerun` badges); MapLibre point map; a
  design-language lock (via `frontend-design-ui-ux`) and dataviz spec; Vercel static
  deploy config; path-scoped CI (schema-vs-sample validation, front build).
- **Does NOT include:** live model inference or any backend (phase 2); regenerating
  real data (phase 1.5, after #20 merges and the owner supplies data); per-country
  forecasting; changing the Python modeling code; any new heavy front-end dependency
  beyond MapLibre and Astryx.

## Acceptance Criteria

- The static site builds via `next build` with `output: 'export'` and serves from
  `web/out/` with zero console errors, dark mode working (gated by the spike below).
- Swapping the sample JSON for real exported JSON changes zero files under `web/`.
- The retracted 0.19 °C never appears in any committed artifact; affected metric
  rows render a visible `pending_rerun` badge; the sample renders a `sample` badge.
- Section framing matches reality: "global temperature signal", "air-quality SHAP",
  point-marker anomaly map.
- The export module has tests (red-green) validating output against the JSON Schemas.
- CI validates the committed sample against the schemas.

## Reproducibility

- Front: `cd web && npm ci && npm run build` (Node LTS; exact deps via committed
  lockfile). Serve `web/out/` statically.
- Data: `python -m src.export_dashboard --out web/public/data` regenerates the JSON
  (sample fixtures deterministic; real run requires `data/raw/` + a notebook/pipeline
  run post-#20).

## Risks and Assumptions

- **Blocking gate — static-export spike (~30 min, before any component work):**
  scaffold Next `output:'export'` + pinned `@astryxdesign/core` + one theme; render
  3 representative components (tabs, table, card); `next build`; serve `out/`; confirm
  hydration, dark mode, zero console errors. Pass → proceed; fail → surface to owner
  with the fallback (keep Next/Vercel, restyle with plain CSS; the fallback costs only
  the component layer).
- **Astryx beta (`v0.1.2`, post training-cutoff):** hedged by exact pin + import
  locality + consulting the CLI manifest/MCP for the real API. Assumption: the
  pre-compiled-CSS path is SSR/prerender-safe.
- **MapLibre weight:** owner accepted the heavier dep; needs a free tile/style source;
  must be client-side-render-safe under static export.
- **Cross-artifact honesty:** #19 (README retraction) must merge before the dashboard
  URL is made public — the site links from the README and must not contradict it.
  Only LightGBM/GB/ensemble are #20-affected.
- **OneDrive:** the repo is under OneDrive; `web/node_modules` must be excluded from
  OneDrive sync (or the repo relocated) before front-end work to avoid file-lock churn.

## Alternatives Considered

- **A — Vite React SPA on GitHub Pages:** simplest/cheapest, but the owner preferred
  Vercel/Next and Astryx documents Next.js; SPA gives no phase-2 structural benefit.
- **C — Astro + React islands:** fast, but Astryx+Astro integration is unproven —
  rejected for integration risk.
- **Lightweight SVG dot-map** (Fable-recommended for anomalies): rejected by the owner
  in favor of a full MapLibre map (heavier dep accepted).

## Delegation (per Fable) & phase boundary

- **Opus:** the static-export spike; the design-language lock + dataviz spec; the
  export-module SPEC + contract semantics.
- **Sonnet (after Spec Gate):** export-module implementation (TDD); dashboard/chart
  components against the locked design + archived Astryx manifest; sample fixtures;
  path-scoped CI.
- **Owner (non-delegable):** Spec Gate approval; Astryx theme/visual direction sign-off;
  merging #19/#20; supplying real data; the Vercel account.
- **Phase 1.5** (trigger: #20 merged + real data): re-run the export, commit JSON with
  `data_status: "real"` — no code change.
- **Phase 2** (deferred): live inference via an external Python service (aligns with
  issue #16), fetched client-side. Do not pre-build for it.
