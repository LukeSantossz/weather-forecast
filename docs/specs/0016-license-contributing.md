# SPEC: docs: add LICENSE and CONTRIBUTING

## Problem
The repository has no `LICENSE` (so the code defaults to all-rights-reserved, undermining a portfolio/open-source presentation) and no `CONTRIBUTING`, although the README and `github.md` assume both exist.

## Design Decision
Add the MIT license (the issue's recommended default for a portfolio project), copyright "2026 Lucas Goncalves". Add a `CONTRIBUTING.md` that summarizes the `.standards` workflow (spec at the Gate, test-first, Conventional Commits, branch naming, the R1/R2/R3 review composition) and points to `.standards/docs/standards/`. Link both from the README via a License and a Contributing section, with an MIT badge that is accurate because the `LICENSE` it points to exists.

## Alternatives Considered
- **Apache-2.0** (explicit patent grant). Rejected: heavier than a portfolio demo needs; the issue names MIT as the default and it is the simplest permissive choice.
- **No license / all-rights-reserved.** Rejected: blocks reuse and contradicts the portfolio framing that the README already adopts.

## Scope
- Includes: `LICENSE` (MIT, 2026 Lucas Goncalves); `CONTRIBUTING.md` referencing `.standards`; README License and Contributing sections plus an MIT badge.
- Does NOT include: adding per-file license headers; a contributor license agreement; any change to the `.standards` submodule.

## Acceptance Criteria
- `LICENSE` exists, is the MIT license, and names the correct holder (Lucas Goncalves) and year (2026).
- `CONTRIBUTING.md` summarizes the contribution workflow and references `.standards`.
- The README links to both `LICENSE` and `CONTRIBUTING.md`, and the MIT badge matches the license.

## Reproducibility
Documentation change, no code. Verify with `test -f LICENSE`, `test -f CONTRIBUTING.md`, and that the README's License/Contributing links resolve to those files.

## Risks and Assumptions
- Assumption: MIT is acceptable (the issue's recommended default); the choice is reversible before any external reuse occurs.
- Assumption: the copyright holder is Lucas Goncalves (the git author) and the year is 2026 (the repository's first-commit year).
- Low risk: additive documentation with no code or runtime impact.
