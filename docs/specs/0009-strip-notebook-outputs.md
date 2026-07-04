# SPEC 0009 — fix(notebooks): strip hardcoded local paths and outputs from notebooks

## Problem
Saved cell outputs in `notebooks/02`–`07` embed absolute local paths from a prior machine (e.g. `C:\Users\lucas\...\pma-weather-forecasting\...`), leaking a developer username and an obsolete project name, and preventing the notebooks from being read or run cleanly on another machine.

## Design Decision
Clear every code cell's `outputs`, `execution_count`, and execution-timing metadata across all committed notebooks (`01`–`07`, for consistency), leaving cell `source` untouched.

## Scope
- Includes: clearing `outputs`, `execution_count`, and cell-level execution timing metadata in every `notebooks/*.ipynb`.
- Does NOT include: changing any code cell source; re-running notebooks to regenerate outputs; adding a pre-commit hook such as `nbstripout` to prevent regressions (that is #13).

## Acceptance Criteria
- No occurrence of `pma-weather` or `C:\Users` in any notebook under `notebooks/`.
- No notebook has non-empty cell outputs or a non-null `execution_count` remaining.
- Code cell sources are unchanged (verified byte-for-byte against the prior committed version).

## Reproducibility
`git grep -n "pma-weather" notebooks/` and `git grep -n "C:\\\\Users" notebooks/` both return nothing; `python -m nbformat` validation passes for all 7 notebooks. Deterministic (no randomness involved).

## Risks and Assumptions
Assumption: no rendered output needs to be preserved for portfolio display; the issue's own recommendation treats notebook outputs as non-reproducible artifacts that should not carry machine state. Low risk: outputs are cleared, not code; existing behavior when notebooks are re-run is unaffected.
