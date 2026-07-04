#!/bin/sh
# R2 cross-provider review gate (Codex CLI).
# See .standards/docs/standards/codex_review.md for the full contract.
#
# Advisory by default: findings are printed but the push is not blocked unless
# CODEX_REVIEW_BLOCKING=1. Reviews the current branch against a base branch.
#
# Environment:
#   SKIP_CODEX_REVIEW=1     Skip the gate for this run.
#   CODEX_REVIEW_BASE=<b>   Base branch to review against (default: main).
#   CODEX_REVIEW_DRYRUN=1   Print the command without invoking Codex.
#   CODEX_REVIEW_BLOCKING=1 Exit non-zero when `codex review` exits non-zero.
#   CODEX_BIN=<path>        Override the Codex binary (testing).

set -u

CODEX_BIN="${CODEX_BIN:-codex}"
BASE="${CODEX_REVIEW_BASE:-main}"
MODEL="gpt-5.5"
EFFORT="high"

# 1. Explicit skip.
if [ "${SKIP_CODEX_REVIEW:-0}" = "1" ]; then
    echo "codex-review: SKIP_CODEX_REVIEW=1 set, skipping R2 review."
    exit 0
fi

# 2. On the base branch there is nothing to review against itself.
current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [ -n "$current_branch" ] && [ "$current_branch" = "$BASE" ]; then
    echo "codex-review: on base branch '$BASE', nothing to review; skipping."
    exit 0
fi

# 3. Dry run: print the exact command and exit.
if [ "${CODEX_REVIEW_DRYRUN:-0}" = "1" ]; then
    echo "$CODEX_BIN review --base $BASE -c model=\"$MODEL\" -c model_reasoning_effort=\"$EFFORT\""
    exit 0
fi

# 4. Codex not installed: advisory skip (R2 did not run).
if ! command -v "$CODEX_BIN" >/dev/null 2>&1; then
    echo "codex-review: Codex not installed ('$CODEX_BIN' not found); skipping (R2 did not run)."
    echo "codex-review: install Codex and run 'codex login', then re-push to enable R2."
    exit 0
fi

# 5. Run the review (advisory).
echo "codex-review: running R2 review of '$current_branch' against '$BASE' (advisory)..."
"$CODEX_BIN" review --base "$BASE" -c model="$MODEL" -c model_reasoning_effort="$EFFORT"
status=$?

if [ "$status" -ne 0 ]; then
    if [ "${CODEX_REVIEW_BLOCKING:-0}" = "1" ]; then
        echo "codex-review: exit $status and CODEX_REVIEW_BLOCKING=1, blocking push."
        exit "$status"
    fi
    echo "codex-review: exit $status; advisory only, push proceeds."
    echo "codex-review: address or justify any finding in the PR (never silently drop it)."
fi
exit 0
