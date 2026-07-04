# Contributing

Thanks for your interest in this project. Contributions follow the development
standards in the [`.standards`](.standards) submodule, which apply equally to
code written by a person or by an AI assistant. Read
[`.standards/docs/standards/INDEX.md`](.standards/docs/standards/INDEX.md) first;
the summary below is not a substitute for it.

## Setup

```sh
git clone --recurse-submodules https://github.com/LukeSantossz/weather-forecast
cd weather-forecast
python -m venv .venv && . .venv/Scripts/activate   # or .venv/bin/activate
pip install -r requirements.txt
```

If you cloned without `--recurse-submodules`, run `git submodule update --init`
so `.standards/` is populated.

## Workflow

1. **Specify before building.** For any non-trivial change, write a `SPEC.md`
   (a numbered `docs/specs/NNNN-*.md`) and pass the Spec Gate before writing
   code, per [`spec_method.md`](.standards/docs/standards/spec_method.md).
2. **Test first.** Follow red-green-refactor: write a failing test, watch it
   fail, then write the minimal code to pass
   ([`code_conventions.md`](.standards/docs/standards/code_conventions.md)).
3. **Branch naming.** `type/TASK-NNN-short-description` using a type from the
   canonical Type Table in [`github.md`](.standards/docs/standards/github.md).
4. **Conventional Commits.** `type(scope): subject`, imperative and lowercase,
   no trailing period. No co-author or AI-attribution lines.
5. **Review.** Work meets the PR at three review layers: R1 internal review,
   R2 cross-provider review (Codex, see
   [`codex_review.md`](.standards/docs/standards/codex_review.md)), and R3
   automated PR review, per
   [`ai_guidelines.md`](.standards/docs/standards/ai_guidelines.md). Note any
   layer that did not run and why.

## Pull requests

Use the PR template from `github.md`: Context, What Was Done, How to Test,
Evidence, and the PR Review Checklist. Keep one coherent change per commit, and
re-read your own diff before requesting review.

## Quality gate

- All tests pass: `python -m pytest -q`.
- All output (identifiers, comments, commit/PR/issue text, docs) is in English.
