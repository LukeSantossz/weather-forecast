#!/usr/bin/env bash
# One-time developer setup: activate the versioned Git hooks (R2 pre-push review gate).
set -euo pipefail
git config core.hooksPath .githooks
echo "core.hooksPath set to .githooks (R2 pre-push gate active; Codex CLI absent is a graceful skip)"
