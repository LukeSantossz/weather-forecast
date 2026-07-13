# ADR 0012: Tree-traversal as the shared inference primitive

- Status: Accepted (2026-07-13).
- Source: SPEC 0033 (Architecture Decisions), promoted at the Spec Gate.

## Context

Every tree model the project will serve client-side (the Isolation Forest now, gradient
boosting in SP2's forecast studio) reduces to walking a binary decision tree from root to
leaf. Reimplementing that walk per model would multiply the surface where a browser-vs-Python
parity bug can hide.

## Decision

Write the binary tree-traversal routine once as the reusable inference core
(`web/lib/inference/isolationForest.ts::treePathLength`). The Isolation Forest path-length
scorer is its first consumer; SP2's gradient-boosting leaf-value scorer will be the second.

## Consequences

- One tested primitive underlies every tree model served client-side, so parity work
  concentrates on a single routine rather than being re-proven per model.
- Alternative considered: a bespoke scorer per model, rejected because it duplicates the
  traversal logic and its parity risk across every future tree model.
