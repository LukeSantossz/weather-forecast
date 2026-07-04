# Deploy (Vercel, static export)

This app is a static, client-only dashboard: `next.config.mjs` sets `output: 'export'`, so
`next build` writes a fully static site to `web/out` (no Next.js server, no API routes, no
image optimization endpoint — `images.unoptimized: true` is already set for this reason).
Vercel can serve that output directly.

## Gating note — do not go live before issue #19 merges

**Do not make the deployed URL public until [issue #19](https://github.com/LukeSantossz/weather-forecast/issues/19)
(README retraction of the leakage-inflated metrics and architecture diagram) merges.**

The dashboard already renders the honest state (the Forecast hero shows the best `final`
statistical model with a `[ LEAKAGE FIX PENDING · #20 ]` chip, per `dashboard-phase1.md`), but
the README currently still advertises the retracted "0.19 °C RMSE" headline and the incorrect
Parquet-based architecture. Publishing the dashboard while the README still makes those claims
would put a correct, honest site next to a contradicting README on the same repo. Deploy the
project (or leave it building on preview URLs) but keep the production domain unassigned/private
until #19 merges.

## Vercel project setup

1. Import the GitHub repo into Vercel as a new project.
2. **Root Directory:** set to `web` (this repo is not a single-package repo; the Next.js app
   lives under `web/`, not at the repo root).
3. **Framework Preset:** `Next.js` — Vercel's Next.js preset auto-detects `output: 'export'` in
   `web/next.config.mjs` and serves the static `web/out` directory itself; no custom Build
   Command or Output Directory override is needed.
4. **Environment Variables:** none. The dashboard reads its data from the committed JSON files
   under `web/public/data/*.json` (SPEC 0006 contract) at build time; there is nothing to
   configure per-environment.
5. **Node version:** use the project default (or pin to the Node version this repo's CI/dev
   environment uses, if one is already pinned elsewhere) — nothing dashboard-specific to set.

No server functions, no ISR, no middleware: this is a plain static export, equivalent to
hosting the contents of `web/out` on any static file host.

## `vercel.json`

Not added. Vercel's Next.js framework preset already auto-detects `output: 'export'` and serves
`web/out` without configuration — there is no custom output directory, rewrite/redirect rule, or
header this project needs beyond that default. Add one later only if a real need shows up (e.g.
custom cache-control headers or a redirect), not preemptively.

## Local equivalent

```
npm --prefix web run build   # writes web/out
npm --prefix web run preview # serves web/out locally via `serve`, for a pre-deploy sanity check
```
