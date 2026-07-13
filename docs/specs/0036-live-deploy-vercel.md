# SPEC: chore(web): publish the dashboard live on Vercel with continuous deploy

Final sub-project (SP4) of the "make the project usable" effort. It gives the project the one
thing a portfolio skim most wants and it currently lacks: a live link that a viewer can click and
operate. It connects the repository to Vercel with continuous deployment so the static dashboard
publishes automatically, and it is positioned early (right after SP1) so that SP2 and SP3 go live
on their own as they merge. It changes no application behavior; it is hosting configuration, a
provenance refresh, and documentation.

## Problem

The dashboard and its interactive features run only locally. `web/DEPLOY.md` already documents that
the app is a static export clear to deploy (the leakage-headline gate was lifted with issues #19/#20),
but no deployment exists: the repository has no connected host and its homepage URL is empty, so there
is no public, operable artifact. Everything built in SP1-SP3 is invisible to anyone who does not clone
and run the repo.

## Design Decision

Connect the GitHub repository to Vercel with Git integration for continuous deployment, following the
setup already documented in `web/DEPLOY.md`: Root Directory `web`, the Next.js framework preset (which
auto-detects `output: 'export'` and serves `web/out`), no `vercel.json`, and no environment variables.
Every merge to `main` deploys automatically and every pull request gets a preview, so once this lands
SP2 and SP3 publish themselves as they merge. Serve on the default `*.vercel.app` subdomain; a custom
domain is deferred.

Before the first publish, regenerate `web/public/data/*.json` at the deploy commit so the provenance
chip shows the correct commit SHA and date (as `DEPLOY.md` requires), set the repository homepage URL
to the live link, and reference the live URL in `README.md` and `web/DEPLOY.md`. Connecting Vercel and
going live is an outward-facing action performed with the owner's Vercel account (via the connected
Vercel MCP, which requires the owner to authenticate, or the Vercel dashboard); this SPEC plans it and
defines how to verify it.

## Architecture Decisions

No new hard-to-reverse design decision here; the hosting choice (Vercel, static export, Root Directory
`web`) was already recorded in `web/DEPLOY.md` and SPEC 0006 ADR-A. This sub-project executes that
decision and adds continuous deployment; it introduces no ADR.

## Scope

- **Includes:**
  - Connecting the repository to a Vercel project (Root Directory `web`, Next.js preset, auto-deploy
    on `main`, PR previews), producing a live `*.vercel.app` URL.
  - Regenerating `web/public/data/*.json` at the deploy commit so provenance is correct at publish.
  - Setting the repository homepage URL to the live link and referencing it in `README.md` and
    `web/DEPLOY.md`.
  - A verification pass over the live site: all acts render, the SP1-SP3 interactive features work,
    provenance is correct, and there are zero console errors in light and dark themes.
- **Does NOT include:**
  - A custom domain (deferred; default subdomain only).
  - Deploying the FastAPI backend: the interactive features are all client-side, so no backend is
    hosted; the API stays a documented artifact.
  - Any `vercel.json`, server function, ISR, middleware, or environment variable (pure static export).
  - Any change to the application code or the data contract beyond the provenance regeneration.

## Acceptance Criteria

- `repo_connected_with_autodeploy`: the repository is connected to Vercel with Root Directory `web` and
  the Next.js preset, and a merge to `main` triggers an automatic production deploy.
- `live_url_serves_dashboard`: the `*.vercel.app` URL serves the dashboard with every act rendering and
  zero console errors in light and dark themes.
- `interactive_features_work_live`: on the live site, the SP1 anomaly checker and (as they land) the SP2
  forecast studio and SP3 verify affordance function with no backend and no post-load network call.
- `provenance_correct_on_live`: `web/public/data/*.json` was regenerated at the deploy commit and the
  live provenance chip shows that commit's SHA and date.
- `homepage_url_set`: the repository homepage URL is the live link, and `README.md` and `web/DEPLOY.md`
  reference it.
- `pr_previews_enabled`: opening a pull request produces a Vercel preview deployment.
- `no_backend_no_env`: the deployment uses no server functions and no environment variables, matching
  `web/DEPLOY.md`.

## Reproducibility

- Setup: follow `web/DEPLOY.md`'s "Vercel project setup" (Root Directory `web`, Next.js preset), connect
  via the Vercel MCP or dashboard with the owner's account.
- Provenance: `npm --prefix web run build` after regenerating `web/public/data/*.json` at the deploy
  commit; confirm the provenance chip against the commit SHA.
- Verify: open the `*.vercel.app` URL and exercise each act and interactive feature; confirm zero console
  errors and correct provenance.

## Risks and Assumptions

- Assumption: connecting Vercel and publishing is done with the owner's authenticated Vercel account; the
  connected Vercel MCP currently needs authentication, which only the owner can complete. Mitigation: this
  SPEC plans and verifies the deploy; the owner performs the account-linked step.
- Risk: publishing at a commit whose committed data is stale would show wrong provenance. Mitigation:
  `provenance_correct_on_live` requires regenerating the contract at the deploy commit before publish.
- Assumption: Vercel's Next.js preset continues to serve `output: 'export'` without a custom build command,
  as `DEPLOY.md` states. Mitigation: if the preset ever needs an override, add the minimal config then, not
  preemptively.
- Assumption: continuous deployment from `main` is desired so SP2/SP3 auto-publish; the owner chose Git
  integration over manual deploys. Mitigation: PR previews and CI (build, checks) gate what reaches `main`.

## Alternatives Considered

- **Manual deploys via the Vercel CLI/MCP on demand.** Rejected: more control but not hands-off; Git
  integration auto-publishes SP2/SP3 as they merge and gives PR previews for free.
- **A custom domain now.** Deferred: the default subdomain is sufficient for a portfolio link and needs no
  DNS the owner must manage; a domain can be added later without rework.
- **Host the static output elsewhere (e.g. GitHub Pages).** Rejected: Vercel was already chosen and
  documented (SPEC 0006 ADR-A, `DEPLOY.md`), and the output stays portable if that ever changes.
- **Deploy only at the end, after SP3.** Rejected: deploying early (after SP1) gives a live link sooner and,
  with continuous deployment, later sub-projects publish themselves.
