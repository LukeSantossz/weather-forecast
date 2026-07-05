# SPEC: refactor(packaging): make the project an installable package

## Problem
The project has no packaging metadata; `src/` is imported via path assumptions (`from src...` after a `sys.path` hack), so it cannot be `pip install`ed, given a CLI/entry point, or containerized.

## Design Decision
Adopt a src-layout package named `weather_forecast` built with `hatchling`. Move `src/*.py` to `src/weather_forecast/*.py`, add `[build-system]` and `[project]` to `pyproject.toml` (keeping the existing `[tool.ruff]`/`[tool.mypy]`), declare the core runtime dependencies the package imports plus `dev` and `notebooks` optional-dependency extras, and rewrite `from src.X` to `from weather_forecast.X` across tests and notebooks. CI installs the package editable (`pip install -e .[dev]`) and runs the suite against it. Notebooks keep working without a mandatory install by inserting `<repo>/src` on `sys.path` before importing `weather_forecast`.

## Alternatives Considered
- **Keep the flat `src/` as the importable package (configure tools to treat `src` as a package name `src`).** Rejected: `src` is not a distributable package name; a real name (`weather_forecast`) is required for install, entry points, and Docker.
- **setuptools build backend.** Rejected in favor of `hatchling`: less boilerplate for a src-layout, no `setup.py`/`MANIFEST.in`.
- **Put every requirement in `[project.dependencies]`.** Rejected: notebook/modeling-only libraries (prophet, lightgbm, shap, statsmodels, matplotlib, seaborn, plotly) are not imported by the package modules; they go in a `notebooks` extra so a plain install stays lean.

## Scope
- Includes:
  - `[build-system]` (hatchling) and `[project]` in `pyproject.toml`: name `weather_forecast`, version `0.1.0`, `requires-python = ">=3.10"`.
  - `[project.dependencies]`: the libraries the package imports (`pandas`, `numpy`, `scikit-learn`, `jsonschema`, `pyarrow`), pinned to the current `requirements.txt` versions.
  - `[project.optional-dependencies]`: `dev` (`pytest`, `ruff`, `mypy`, `pre-commit`, `nbstripout`) and `notebooks` (`prophet`, `lightgbm`, `shap`, `statsmodels`, `matplotlib`, `seaborn`, `plotly`, `nbformat`).
  - Move `src/*.py` -> `src/weather_forecast/*.py`; keep `__init__.py`.
  - Rewrite imports `from src.X` -> `from weather_forecast.X` in `tests/` and `notebooks/` (including the #0015 export cells); update the notebook `sys.path` insert to `<repo>/src`.
  - `requirements.txt` becomes `-e .[notebooks]` so `pip install -r requirements.txt` still yields a full notebook environment.
  - Update `.github/workflows/ci.yml` test job to `pip install -e .[dev]`; lint job to `pip install -e .[dev]`.
- Does NOT include:
  - Any CLI / entry-point (that is #14) or Dockerfile (#16).
  - Changing module code beyond the import path and file location.
  - Un-pinning dependency versions (the pins from #10 are preserved).

## Acceptance Criteria
- `pip install -e .` succeeds in a clean environment and `python -c "import weather_forecast"` works.
- No `from src.` import remains in `tests/` or `notebooks/`; `grep -rn "from src\\." tests notebooks` is empty.
- `pytest -q` passes against the installed package (imports resolve as `weather_forecast.X`).
- `ruff check .`, `ruff format --check .`, and `mypy src/` stay green.
- `.github/workflows/ci.yml` installs the package (`pip install -e .[dev]`) in both jobs and the suite passes.
- The committed dashboard contract and `next build` are unaffected (no web change).

## Reproducibility
Clean venv: `python -m pip install -e .[dev]` then `pytest -q`. Notebook check: from `notebooks/`, the `sys.path` insert of `<repo>/src` makes `import weather_forecast` resolve without a global install. Build backend `hatchling`; Python 3.10.

## Risks and Assumptions
- Assumption: only the package modules need the core deps; tests do not import prophet/lightgbm/shap/statsmodels (verified: tests import pandas/numpy/sklearn/jsonschema/pyarrow only), so `[dev]` suffices for CI tests.
- Assumption: moving files under `src/weather_forecast/` plus a `sys.path` insert of `<repo>/src` keeps notebooks runnable without a mandatory editable install.
- Medium risk: a repo-wide import rewrite. Mitigated by the empty-grep acceptance check and the full suite passing against the installed package.
- This is a foundational, hard-to-reverse decision (package name, layout, import convention); it may warrant an ADR at the Gate.
