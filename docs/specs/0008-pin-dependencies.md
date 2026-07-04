# SPEC 0008 — build(deps): pin dependency versions for reproducible builds

## Problem
`requirements.txt` lists every dependency with no version constraint. A fresh
`pip install -r requirements.txt` resolves to whatever the newest compatible
release is on the day it runs, so CI (Python 3.10 and 3.11) and any
contributor's machine can silently pick different, non-reproducible dependency
graphs. Two listed dependencies, `folium` and `kaggle`, are not imported by
any code in `src/` or `notebooks/`.

## Design Decision
Pin every top-level dependency in `requirements.txt` to an exact version
(`pkg==x.y.z`) resolved from a fresh install, using the newest release that
installs on both Python 3.10 and 3.11 (the CI matrix); drop the two unused
dependencies, `folium` and `kaggle`.

## Scope
- Includes: exact `==` pins for all 14 remaining top-level dependencies in
  `requirements.txt`; removal of the unused `folium` and `kaggle` entries.
- Does NOT include: migrating to `pyproject.toml`/`uv`/Poetry or adding a
  lockfile tool (e.g. `pip-tools`, `uv.lock`); pinning transitive
  dependencies; changing any application or notebook code; re-adding
  `folium`/`kaggle` even if a future feature needs them (a separate change
  would restore and pin them then).

## Acceptance Criteria
- Every non-comment line in `requirements.txt` is pinned to an exact version.
- `folium` and `kaggle` are absent from `requirements.txt`, confirmed unused
  by `grep` across `src/` and `notebooks/`.
- A fresh `pip install -r requirements.txt` succeeds, and `pytest tests/ -q`
  passes, on both Python 3.10 and Python 3.11.

## Reproducibility
On a clean virtualenv per Python version:
`python -m pip install -r requirements.txt && python -m pytest tests/ -q`.
Verified on Python 3.10.11 (70 passed) and Python 3.11.9 (70 passed) with the
pinned set: pandas 2.3.3, numpy 2.2.6, matplotlib 3.10.9, seaborn 0.13.2,
scikit-learn 1.7.2, prophet 1.3.0, lightgbm 4.6.0, shap 0.49.1, plotly 6.8.0,
nbformat 5.10.4, pyarrow 24.0.0, pytest 9.1.1, statsmodels 0.14.6, jsonschema
4.26.0.

## Risks and Assumptions
- Assumption: pandas 3.x is acceptable per issue #24 (the `str`-dtype
  migration is already handled), but pandas 3.0.3 requires Python >= 3.11 and
  cannot install on the CI's Python 3.10 job. Since a single `requirements.txt`
  must serve both interpreters, this pin uses the newest release that
  installs on both: pandas 2.3.3 (last 2.x release), rather than 3.0.3. The
  same constraint applies transitively to numpy, matplotlib, scikit-learn,
  and shap, which each had a newer release available on 3.11 alone; the
  3.10-compatible version was chosen for all of them so one file works on
  both CI jobs.
- Low risk: pins only change *which* version installs, not application
  behavior; the full test suite passes unchanged on both interpreters.
