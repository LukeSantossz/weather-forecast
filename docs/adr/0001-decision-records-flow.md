# ADR 0001: Decision records flow

- Status: Accepted (2026-07-07).
- Source: `.standards/docs/standards/spec_method.md` and `github.md`.

## Context

The project needs one durable place for significant, hard-to-reverse decisions, distinct from
a SPEC's transient Alternatives Considered and from the README's reader-facing index.

## Decision

A SPEC's Design Decision is promoted at the Spec Gate to a numbered ADR under `docs/adr/` when
it is hard to reverse, surprising, and a real trade-off. The SPEC's Alternatives Considered
stays transient. The README Engineering Decisions section indexes the ADRs, linking each rather
than restating its rationale. ADRs are numbered sequentially (`NNNN-<slug>.md`).

## Consequences

- Rationale lives once, in the ADR; the README links it; the SPEC records the rejected options.
- ADR numbers are stable; superseded ADRs are marked, not deleted.
