#!/usr/bin/env bash
# One-time developer setup: install the package with dev tools so the pre-push hook's
# ruff and pytest resolve, then point Git at the versioned hooks (R2 pre-push review gate).
set -euo pipefail
# Editable install with dev extras (pytest, ruff) into the active environment, so the
# pre-push hook runs `pytest -q` and `ruff` without any PYTHONPATH juggling.
python -m pip install -e ".[dev]"
git config core.hooksPath .githooks
echo "installed weather_forecast (editable, dev extras) and set core.hooksPath to .githooks"
echo "(R2 pre-push gate active; Codex CLI absent is a graceful skip)"
