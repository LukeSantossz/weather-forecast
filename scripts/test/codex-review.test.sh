#!/bin/sh
# Guard-logic tests for scripts/codex-review.sh (SPEC 0012).
# Deterministic: uses a stub CODEX_BIN and dry-run. No live Codex, no network.

set -u

SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)"
RUNNER="$REPO_ROOT/scripts/codex-review.sh"

fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

# assert_exit <desc> <expected_code> <actual_code>
assert_exit() {
    if [ "$2" != "$3" ]; then
        bad "$1: expected exit $2, got $3"
    else
        pass "$1 (exit $3)"
    fi
}

# assert_contains <desc> <output> <needle>
assert_contains() {
    if printf '%s' "$2" | grep -qF -- "$3"; then
        pass "$1"
    else
        bad "$1: output missing '$3'"
        printf '%s\n' "$2"
    fi
}

if [ ! -f "$RUNNER" ]; then
    echo "FAIL - runner not found at $RUNNER"
    exit 1
fi

# Stub codex binary that exits non-zero (simulates findings/error).
STUB="$(mktemp)"
cat > "$STUB" <<'EOF'
#!/bin/sh
echo "stub-codex invoked: $*"
exit 3
EOF
chmod +x "$STUB"

cd "$REPO_ROOT"

# 1. Dry-run prints the exact command and exits 0 without invoking Codex.
out=$(CODEX_REVIEW_DRYRUN=1 CODEX_REVIEW_BASE=main sh "$RUNNER" 2>&1); code=$?
assert_exit "dryrun exits 0" 0 "$code"
assert_contains "dryrun prints command" "$out" 'review --base main -c model="gpt-5.5" -c model_reasoning_effort="high"'

# 2. SKIP flag short-circuits.
out=$(SKIP_CODEX_REVIEW=1 sh "$RUNNER" 2>&1); code=$?
assert_exit "skip flag exits 0" 0 "$code"
assert_contains "skip flag message" "$out" "SKIP_CODEX_REVIEW"

# 3. On the base branch there is nothing to review -> skip.
cur=$(git rev-parse --abbrev-ref HEAD)
out=$(CODEX_REVIEW_BASE="$cur" sh "$RUNNER" 2>&1); code=$?
assert_exit "base-branch skip exits 0" 0 "$code"
assert_contains "base-branch skip message" "$out" "nothing to review"

# 4. Codex absent -> advisory skip, R2 did not run.
out=$(CODEX_BIN="/nonexistent/codex" CODEX_REVIEW_BASE=main sh "$RUNNER" 2>&1); code=$?
assert_exit "codex-absent exits 0" 0 "$code"
assert_contains "codex-absent message" "$out" "not installed"

# 5. Advisory by default: stub exits 3, runner still exits 0.
out=$(CODEX_BIN="$STUB" CODEX_REVIEW_BASE=main sh "$RUNNER" 2>&1); code=$?
assert_exit "advisory default exits 0" 0 "$code"

# 6. Blocking mode: stub exits 3, runner propagates non-zero.
out=$(CODEX_BIN="$STUB" CODEX_REVIEW_BLOCKING=1 CODEX_REVIEW_BASE=main sh "$RUNNER" 2>&1); code=$?
if [ "$code" -eq 0 ]; then
    bad "blocking mode should exit non-zero, got 0"
    printf '%s\n' "$out"
else
    pass "blocking mode exits non-zero (exit $code)"
fi

rm -f "$STUB"

# 7. Pre-push hook exists and invokes the runner.
HOOK="$REPO_ROOT/.githooks/pre-push"
if [ -f "$HOOK" ]; then
    pass "pre-push hook exists"
    assert_contains "pre-push invokes runner" "$(cat "$HOOK")" "codex-review.sh"
else
    bad "pre-push hook missing at $HOOK"
fi

# 8. AGENTS.md exists and references the binding standards.
AGENTS="$REPO_ROOT/AGENTS.md"
if [ -f "$AGENTS" ]; then
    pass "AGENTS.md exists"
    assert_contains "AGENTS.md references standards" "$(cat "$AGENTS")" ".standards/docs/standards"
else
    bad "AGENTS.md missing at $AGENTS"
fi

if [ "$fail" -eq 0 ]; then
    echo "ALL PASS"
    exit 0
fi
echo "SOME FAILED"
exit 1
