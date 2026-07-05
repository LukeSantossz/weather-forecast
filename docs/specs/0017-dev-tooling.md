# SPEC: ci(quality): add ruff, mypy, and pre-commit gates

## Problem
The framework assumes automated quality gates but only `pytest` runs in CI (issue #13): there is no linter, formatter, type-checker, or pre-commit hook, so style drift, unused imports, and type errors are caught only by manual review.

## Design Decision
Add ruff (lint + format) and mypy (lenient) configured in `pyproject.toml`, a pinned `requirements-dev.txt` separate from runtime `requirements.txt`, a `.pre-commit-config.yaml` (ruff lint + format, nbstripout, trailing-whitespace, end-of-file-fixer), and a `lint` job in `.github/workflows/ci.yml` running the same checks on Python 3.11 alongside the existing `test` matrix. Apply ruff's autofixes and a few non-behavioral manual fixes to `src/` and `tests/`. Extend the existing `.githooks/pre-push` (added for the Codex R2 gate in #40) so it runs lint + tests first (blocking) and then the advisory Codex review, rather than replacing it.

## Alternatives Considered
- **flake8 + black + isort** instead of ruff. Rejected: ruff replaces all three with one fast, single-config tool already standard in the ecosystem.
- **Strict mypy across pandas.** Rejected: pandas typing noise would swamp the signal; `ignore_missing_imports = true` with default strictness is a pragmatic first gate.
- **A separate lint-only pre-push, leaving Codex review manual (the original ci/13 WIP).** Rejected: the R2 gate (#40) already owns pre-push; two hooks would fight over `core.hooksPath`. Composing them into one hook is the coherent result.

## Scope
- Includes: `requirements-dev.txt` (pinned `ruff`, `mypy`, `pre-commit`, `nbstripout`); `[tool.ruff]`/`[tool.mypy]` in `pyproject.toml`; `.pre-commit-config.yaml`; a `lint` job in `ci.yml`; non-behavioral lint/format fixes in `src/` and `tests/`; `scripts/enable-hooks.sh`; the composed `.githooks/pre-push` (lint + tests + advisory Codex review).
- Does NOT include: `[project]` packaging metadata / making the project pip-installable (that is #12; this `pyproject.toml` carries tool config only); linting/formatting `notebooks/*.ipynb` code cells, `README.md`, or `web/` (`extend-exclude = ["notebooks"]`); strict pandas typing; any change to runtime behavior or public signatures; making pre-commit or the local hook a required CI gate.

## Acceptance Criteria
- `ruff check .` exits 0 and `ruff format --check .` exits 0 on the repository.
- `mypy src/` exits 0.
- `pip install -r requirements-dev.txt` installs the pinned versions.
- `.github/workflows/ci.yml` is valid YAML with the existing `test` matrix unchanged and a new `lint` job.
- `pytest -q` still passes with no behavior change in `src/`.

## Reproducibility
`.venv-run/Scripts/python.exe -m pip install -r requirements-dev.txt`, then `ruff check .`, `ruff format --check .`, `mypy src/`, and `pytest -q`. Pinned versions verified installable on Python 3.10.11: ruff 0.15.20, mypy 2.1.0, pre-commit 4.6.0, nbstripout 0.9.1.

## Risks and Assumptions
- Assumption: "a sensible rule set" means ruff's `E`, `F`, `I`, `W`, `UP`, `B` selectors; the current code has no `B` (bugbear) violations, so no per-file ignore is needed.
- Assumption: the pre-push hook only runs where dev deps are installed; it guards on `ruff` being present and skips lint with a message if not, so it never hard-blocks a push for a missing tool.
- Low risk: every `src/`/`tests/` change is an automatic ruff transform or a same-meaning manual rewrite (`typing.Union[X, Y]` -> `X | Y`, docstring line wraps); `pytest` stays green (94 passed), proving no behavior change.
