# AGENTS.md

Guidance for Codex (OpenAI) working in this repository, both as an Author (code
creation) and as the R2 cross-provider Reviewer defined in
`.standards/docs/standards/codex_review.md`. The Author of record is Claude
(Anthropic); Codex being a different provider is what satisfies the R2 gate.

## Binding standards

Before creating or reviewing code, read `.standards/docs/standards/INDEX.md` and the
documents it lists. They are binding, whether code is written by a person or an agent:

- Specify before building: a non-trivial change starts with a spec that passes the Spec
  Gate (a numbered `docs/specs/NNNN-*.md`), per `spec_method.md`. The spec is the source
  of truth for intent and scope.
- Follow `code_conventions.md` (authoritative precedence order for any conflict) and
  `var_method.md` (naming suffixes, the lowest layer of precedence).
- Write tests before implementation (red-green-refactor).
- Conventional Commits, branch naming, and the PR/Issue/README templates per `github.md`.
  Never add co-author or AI-attribution lines to commits.
- Token economy per `token_economy.md`: terse mode is allowed in conversation but never in
  spec, PR, issue, or commit artifacts; it never overrides Safety or Correctness.
- All output in English.

## Role: Author (code creation)

When asked to create or change code, honor the approved spec and its Scope. Keep changes
minimal, never invent an API or signature (check the code or ask), never add unrequested
abstraction, and never silence errors (no empty `except`, no swallowed exception).

## Role: Reviewer (R2 gate)

When invoked as `codex review` (the pre-push gate), you are the cross-provider Reviewer for
R2. Report correctness defects, scope drift from the spec, and convention violations, most
severe first. Findings are advisory, not binding, but an unresolved finding must be
addressed or justified in the PR, never silently dropped (`ai_guidelines.md`).

## Commands

- Tests: `python -m pytest -q`
- R2 review, manual: `sh scripts/codex-review.sh`
  (dry-run: `CODEX_REVIEW_DRYRUN=1 sh scripts/codex-review.sh`)
- Enable the pre-push R2 gate (one-time, local, not committed):
  `git config core.hooksPath .githooks`
  Requires `codex` on `PATH` and an authenticated session (`codex login`); verify with
  `codex doctor`.
