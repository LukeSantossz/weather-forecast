# Deploy (Vercel, static export)

This app is a static, client-only dashboard: `next.config.mjs` sets `output: 'export'`, so
`next build` writes a fully static site to `web/out` (no Next.js server, no API routes, no
image optimization endpoint - `images.unoptimized: true` is already set for this reason).
Vercel can serve that output directly.

## Live

<https://weather-forecast-neon-iota.vercel.app>

Vercel project `weather-forecast` (team `lukesantosszs-projects`), linked to the GitHub repo with
Root Directory `web` and the Next.js preset. Pushes to `main` deploy to production; pull requests
get preview deployments. Vercel Authentication is off, so the URL is publicly readable.

One caveat: the committed data contract under `web/public/data/` was generated at commit
`24b7120`, so the live provenance banner reports that commit rather than the deployed one.
Regenerating the contract needs the source CSV (see the repository README).

## Status - deployed

The earlier gate (do not go live until the README retracted the leakage-inflated headline,
issues [#19](https://github.com/LukeSantossz/weather-forecast/issues/19) /
[#20](https://github.com/LukeSantossz/weather-forecast/issues/20)) has been lifted: both merged,
and the README and the dashboard now show the same corrected, leakage-free metrics. The site is
public. Regenerate `web/public/data/*.json` from the current commit whenever the source CSV is
available, so the provenance banner shows the right date and SHA.

## Vercel project setup

This is the setup already applied to the live project; it is kept here as the record of how it
was configured, and as the recipe if it ever has to be rebuilt.

1. Import the GitHub repo into Vercel as a new project.
2. **Root Directory:** set to `web` (this repo is not a single-package repo; the Next.js app
   lives under `web/`, not at the repo root).
3. **Framework Preset:** `Next.js` - Vercel's Next.js preset auto-detects `output: 'export'` in
   `web/next.config.mjs` and serves the static `web/out` directory itself; no custom Build
   Command or Output Directory override is needed.
4. **Environment Variables:** none. The dashboard reads its data from the committed JSON files
   under `web/public/data/*.json` (SPEC 0006 contract) at build time; there is nothing to
   configure per-environment.
5. **Node version:** use the project default (or pin to the Node version this repo's CI/dev
   environment uses, if one is already pinned elsewhere) - nothing dashboard-specific to set.

No server functions, no ISR, no middleware: this is a plain static export, equivalent to
hosting the contents of `web/out` on any static file host.

## `vercel.json`

Not added. Vercel's Next.js framework preset already auto-detects `output: 'export'` and serves
`web/out` without configuration - there is no custom output directory, rewrite/redirect rule, or
header this project needs beyond that default. Add one later only if a real need shows up (e.g.
custom cache-control headers or a redirect), not preemptively.

## Local equivalent

```
npm --prefix web run build   # writes web/out
npm --prefix web run preview # serves web/out locally via `serve`, for a pre-deploy sanity check
```
