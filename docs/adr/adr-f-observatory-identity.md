# ADR-F: Replace the "instrument console" identity with "Observatory"

- Status: Accepted (2026-07-07). Approved at the SPEC 0031 Spec Gate; implemented on
  `feat/observatory-visual-redesign` (PR #59).
- Supersedes: the `.ulpi/design/DESIGN.md` "instrument console" lock and the presentation
  half of SPEC 0006. Preserves SPEC 0006 ADR-D and ADR-E unchanged.
- Source SPEC: `docs/specs/0031-observatory-visual-redesign.md` (ADR candidate F).

## Context

The dashboard's graphite-plus-amber "instrument console" identity read as
generic-technical for the primary audience: a machine-learning hiring skim. The copy was
caveat-forward and had gone stale relative to the committed data, weakening a genuinely
strong result. The core skill to signal is turning a model into insight, which a
data-journalism identity communicates better than a console.

## Decision

Re-theme the existing Astryx dashboard into a new locked identity, "Observatory": warm-ink
neutrals (dark ground near `#141210`, light re-derived near `#f7f6f3`), a single ember
accent (`#f2612c`, light-tuned `#d8511c`), a glacier-cyan cool pole (`#3fa9c7`) anchoring
the physically-real diverging temperature scale, a serif-display and IBM Plex Mono type
pairing, and the Ed-Hawkins warming-stripes as the recurring signature. The identity is
applied by overriding Astryx's CSS-variable tokens (the ADR-B convention from SPEC 0006)
plus the existing bespoke dataviz layer, not by rebuilding components. `.ulpi/design/DESIGN.md`
is rewritten to the Observatory identity as the new locked source of truth.

## Consequences

- The React app, the Python-owned data contract (`web/public/data/*` and its schemas), and
  the Astryx component library stay as they are (ADR-D holds).
- `.ulpi/design/DESIGN.md` is now the Observatory identity; the prior console lock is retired.
- Type and colour choices are locked; individual faces remain a swappable build detail
  (see ADR-H).
- If a specific Astryx component resists token theming, the fallback is a thin CSS wrapper
  for that one component, not a new component library.
