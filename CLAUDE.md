# CLAUDE.md

## Development Standards

Before any development work in this repository, read `.standards/docs/standards/INDEX.md`
and the documents it lists. Treat them as binding:

- Specify before building: produce a `SPEC.md` per `.standards/docs/standards/spec_method.md`
  and pass the Spec Gate before writing code for any non-trivial change.
- Follow `.standards/docs/standards/code_conventions.md`, including its precedence order,
  which is authoritative for resolving any conflict between rules.
- Write tests before implementation (red-green-refactor), per the Testing section of
  `.standards/docs/standards/code_conventions.md`.
- Follow `.standards/docs/standards/var_method.md` for naming suffixes (the lowest layer
  of the naming precedence order).
- Follow `.standards/docs/standards/ai_guidelines.md` for self-review and the Review
  Composition hierarchy (R1 internal, R2 cross-provider, R3 automated PR).
- Follow `.standards/docs/standards/github.md` for Conventional Commits, branch naming,
  and the PR, Issue, and README templates. No co-author or AI-attribution lines in commits.
- Token economy per `.standards/token_economy.md` (this file lives at the submodule root,
  not under `docs/standards/`, and is not listed in that index): terse mode is allowed in
  conversation but never in `SPEC.md`, PR, Issue, or commit artifacts, and it never
  overrides Safety or Correctness.
- All output in English.

## Standards submodule

The standards live in the `.standards` git submodule, pinned to a specific commit of
`https://github.com/LukeSantossz/my-framework`. After cloning this repository, run
`git submodule update --init` (or clone with `--recurse-submodules`) so `.standards/`
is populated. To pull a newer version of the standards, run
`git submodule update --remote .standards` and commit the updated pointer.
