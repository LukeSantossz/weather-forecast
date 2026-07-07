# ADR 0003: Single-scroll narrative replaces the tab IA

- Status: Accepted (2026-07-07). Approved at the SPEC 0031 Spec Gate; implemented on
  `feat/observatory-visual-redesign` (PR #59).
- Source SPEC: `docs/specs/0031-observatory-visual-redesign.md` (ADR candidate G).

## Context

The three flat tabs (Forecast, Anomalies, Drivers) read as a tool rather than a narrative.
For a hiring skim, a guided story with the charts as the hero communicates the result more
effectively than tabs the reader must discover and click through.

## Decision

`app/page.tsx` moves from `TabList`/`Tab` to one scrolling page of sections: a thesis hero,
then three annotated acts (Forecast, Anomalies, Drivers), then a reproducibility close. Each
act stays deep-linkable via a hash anchor (`#forecast`, `#anomalies`, `#drivers`) with
scroll-into-view, so no addressability is lost.

## Consequences

- The tabs' depth is preserved as acts, not discarded; there is a single information
  architecture to maintain.
- Deep-linking behaviour changes from tab state to hash anchors; mitigated by the per-act
  anchors and scroll-into-view, and asserted by `web/scripts/check-redesign.mjs` (no
  `TabList` in the page source).
- The sticky header/banner offset must be accounted for when scrolling to an anchor so the
  target is not hidden beneath them.
