# ADR 0004: Production typography via next/font, self-hosted

- Status: Accepted (2026-07-07). Approved at the SPEC 0031 Spec Gate; implemented on
  `feat/observatory-visual-redesign` (PR #59).
- Supersedes: the `.ulpi/design/DESIGN.md` Archivo/Hanken pairing.
- Source SPEC: `docs/specs/0031-observatory-visual-redesign.md` (ADR candidate H).

## Context

The Observatory identity (ADR 0002) calls for a serif-display and mono-data pairing, which is
the data-journalism signature and deliberately distinct from the all-grotesk console. The
faces must load without a runtime CDN dependency and without layout shift.

## Decision

Serve a serif display face, a grotesk body face, and IBM Plex Mono for data via `next/font`,
self-hosted with metric-matched fallbacks and no runtime CDN. The three type roles
(display, body, data) are fixed; the specific faces are a swappable build detail subject to
owner sign-off, as with the original Astryx theme sign-off.

## Consequences

- No third-party font CDN at runtime; fonts ship with the static export.
- Metric-matched fallbacks avoid layout shift while the web fonts load.
- Swapping a face if it reads as generic or clashes is a build-detail change, not an
  identity change, so it does not require a new ADR.
