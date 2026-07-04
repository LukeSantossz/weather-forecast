# SPEC: chore(codex): wire Codex CLI as the R2 review gate and creation agent

## Problem
The framework's R2 cross-provider review and Codex-as-author workflow are specified in `.standards/docs/standards/codex_review.md` but not implemented: the repo has no `AGENTS.md`, no `scripts/codex-review.sh`, and no pre-push gate, so Codex neither reviews a branch before push nor has a role/standards file to guide code creation.

## Design Decision
Implement exactly what `codex_review.md` specifies, no more. Add `AGENTS.md` at the repo root as Codex's role and binding-standards entry point (used for both creation and review). Add `scripts/codex-review.sh`, a guarded POSIX-sh runner that invokes `codex review --base "$base" -c model="gpt-5.5" -c model_reasoning_effort="high"` with the documented switches (`SKIP_CODEX_REVIEW`, `CODEX_REVIEW_DRYRUN`, `CODEX_REVIEW_BLOCKING`, `CODEX_REVIEW_BASE`, `CODEX_BIN`). Add `.githooks/pre-push` that calls the runner. Add `scripts/test/codex-review.test.sh` covering the runner's guard logic with a stub `CODEX_BIN` and dry-run (no network). Activation stays a one-time local step (`git config core.hooksPath .githooks`), not committed, per the standard. The invocation surface was verified against the installed `codex-cli 0.132.0` (`codex review` supports `--base`, `-c key=value`).

## Alternatives Considered
- **pre-commit hook instead of pre-push.** Rejected: the standard fixes the gate at pre-push (review the whole branch against `main` once), while pre-commit would re-run per commit and slow the loop.
- **Blocking by default (push fails on findings).** Rejected: `ai_guidelines.md`/`codex_review.md` define R2 findings as advisory ("advisory, not binding, but must be addressed or justified, never silently dropped"). Default-blocking would contradict the standard; kept behind `CODEX_REVIEW_BLOCKING=1`.
- **Put the config in `.git/hooks/`.** Rejected: not versioned or shareable; the standard mandates a versioned `.githooks/` plus `core.hooksPath`.
- **Fold Codex review into the future #13 lint+test pre-push.** Deferred, not rejected: kept as a separate runner so the hooks compose. When #13's lint+test hook lands (backed up on `ci/13-quality-gates`), the pre-push runs lint, tests, then the advisory Codex review. Out of scope here.

## Scope
- Includes:
  - `AGENTS.md` (repo root): Codex role (Author for creation, Reviewer for R2), pointer to `.standards/docs/standards/` as binding, English-only, SPEC-first, Conventional Commits, test-first, and the key commands.
  - `scripts/codex-review.sh`: guarded runner honoring `SKIP_CODEX_REVIEW`, base-branch skip, codex-absent skip (exit 0; "R2 did not run"), `CODEX_REVIEW_DRYRUN`, `CODEX_REVIEW_BLOCKING`, `CODEX_REVIEW_BASE` (default `main`), `CODEX_BIN`.
  - `.githooks/pre-push`: calls `scripts/codex-review.sh`.
  - `scripts/test/codex-review.test.sh`: guard-logic tests using a stub `CODEX_BIN` and dry-run; no live Codex or network.
  - The one-time local activation note lives in `AGENTS.md` (kept out of `README.md` to avoid conflicting with the in-flight README PR #38).
- Does NOT include:
  - Enabling the hook or committing `core.hooksPath` (local, per-clone, per standard).
  - The #13 lint+test pre-push and CI lint job (separate branch `ci/13-quality-gates`).
  - Any change to `CLAUDE.md`, existing `src/`/`tests/`, or runtime behavior.
  - Calling the live Codex API or network in tests.

## Acceptance Criteria
- `runner_prints_command_in_dryrun`: `CODEX_REVIEW_DRYRUN=1 CODEX_REVIEW_BASE=main sh scripts/codex-review.sh` prints the exact `codex review --base main -c model="gpt-5.5" -c model_reasoning_effort="high"` command and exits 0 without invoking Codex.
- `runner_skips_when_skip_flag_set`: `SKIP_CODEX_REVIEW=1 sh scripts/codex-review.sh` prints a skip message and exits 0.
- `runner_skips_on_base_branch`: when the current branch equals the base, it prints a skip message and exits 0.
- `runner_skips_when_codex_absent`: with `CODEX_BIN=/nonexistent`, it prints a "Codex not installed" message and exits 0 (R2 did not run).
- `runner_advisory_vs_blocking`: with a `CODEX_BIN` stub that exits non-zero, the default run exits 0 (advisory) while `CODEX_REVIEW_BLOCKING=1` exits non-zero.
- `pre_push_hook_invokes_runner`: `.githooks/pre-push` exists and calls `scripts/codex-review.sh`.
- `agents_md_references_binding_standards`: `AGENTS.md` exists at the repo root and references `.standards/docs/standards/`.
- `guard_suite_passes`: `sh scripts/test/codex-review.test.sh` exits 0.

## Reproducibility
`sh scripts/test/codex-review.test.sh` (deterministic; stub `CODEX_BIN`, no network). Manual gate: `CODEX_REVIEW_DRYRUN=1 sh scripts/codex-review.sh`. Live review after `codex login`: `sh scripts/codex-review.sh`. Toolchain: `codex-cli 0.132.0` (installed at `~/AppData/Roaming/npm/codex`), git-bash/sh. Reviewer model `gpt-5.5`, reasoning effort `high`, per `codex_review.md`.

## Risks and Assumptions
- Assumption: `codex review --base <b> -c model=... -c model_reasoning_effort=...` is correct; verified against `codex review --help` for `codex-cli 0.132.0`. If a future CLI changes flags, the dry-run and codex-absent guards keep `git push` working regardless.
- Assumption: `gpt-5.5` is available to the user's Codex account. If not, the advisory default lets the push proceed; the model is one editable `-c model=` line.
- Assumption: POSIX `sh` (git-bash) is available on the developer machine (Windows).
- Low risk: everything is additive and advisory; no existing file or runtime behavior changes, and the hook only fires after the user runs `git config core.hooksPath .githooks`.
