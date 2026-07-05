#!/bin/sh
# One-time, local setup: point Git at the versioned .githooks/ directory so the
# pre-push gate (lint + tests, then the advisory Codex R2 review) runs on every
# push from this clone.
set -e

git config core.hooksPath .githooks
echo "Local git hooks enabled (core.hooksPath=.githooks)."
