# SPEC: docs(readme): make a fresh clone runnable and align the README with the code

## Problem

A reader who clones this repository and follows the README cannot get to a working state:
the documented test command fails to collect, the documented run command fails with
`FileNotFoundError` because the dataset is neither bundled nor sourced anywhere in the
repository, and several README claims describe a dashboard, a regeneration procedure, and a
test count that no longer match the code.

## Design Decision

Fix the two executable defects in the repository first, then rewrite the README so that every
command in it has been run and every claim in it is checkable against a file in the repository.
The README states plainly which paths work on a fresh clone with no external data (the test
suite and the dashboard, whose JSON data contract is committed) and which paths require the
Kaggle source CSV (the training CLI, the drift CLI, the notebooks, and the persisted forecaster
that `POST /forecast` serves), and it links the dataset so the reader can obtain it. The
canonical README section order from `.standards/docs/standards/github.md` is preserved; the only
addition ahead of it is a short lead block that routes the reader to the zero-setup path.

The two code changes are deliberately minimal and carry no behavior change:

1. `tests/test_api.py` gains a `pytest.importorskip("fastapi")` guard, matching the guard
   already used by `test_drift.py`, `test_tracking.py`, and `test_semantic_search.py` for their
   own optional extras. Without it, `fastapi` being declared only in the `serving` extra makes
   the whole suite fail at collection under the install the README documents.
2. The module docstrings of `scripts/_gen_anomaly_model.py` and `scripts/_gen_parity_fixture.py`
   stop describing the raw CSV as committed. It is gitignored and absent from the repository.

## Alternatives Considered

- **Add `serving` to `requirements.txt` instead of guarding the test.** Rejected: it makes one
  test file's optional dependency mandatory for every reader, and it contradicts the guard
  pattern the project already applies to the `mlops` and `nlp` extras. The guard keeps the
  extras optional and consistent.
- **Commit a small sample of the source CSV so the training CLI runs on a fresh clone.**
  Rejected: the dataset carries its own Kaggle licence terms, and a truncated sample would
  produce metrics that disagree with the published Results table, which is a worse failure than
  a clear "download this file" instruction.
- **Leave the README structure alone and only correct the wrong facts.** Rejected: the
  ordering problem is itself a defect for the intended reader. The dataset requirement was
  documented only in Known Issues, below the Getting Started section that depends on it.
- **Build this change on top of the open pull request #68, which audits the same README.**
  Rejected: #68 does not address the dataset gap, the collection failure, or the submodule
  clone, so the branches would have to be reconciled anyway. The verified corrections it found
  are carried into this change and #68 is superseded rather than extended.

## Scope

- **Includes:**
  - `README.md`: rewritten against the code, with the dataset source, a zero-setup path, the
    corrected test count, the corrected dashboard description, the corrected data-contract
    regeneration procedure, and the corrected provenance strings.
  - `tests/test_api.py`: an `importorskip` guard for the `serving` extra.
  - `scripts/_gen_anomaly_model.py` and `scripts/_gen_parity_fixture.py`: docstring accuracy.
  - This spec.
- **Does NOT include:**
  - Any change to pipeline behavior, model hyperparameters, metrics, or the committed data
    contract under `web/public/data/`.
  - Regenerating the data contract at the current commit (it needs the source CSV and is
    tracked separately).
  - Deploying the dashboard or adding a live URL (issue #64).
  - Reconciling notebook 06 with `weather_forecast.models` (issue-level work, recorded as a
    limitation instead).
  - New features, new dependencies, new CI jobs, or architectural change.

## Acceptance Criteria

- `pytest_collects_without_serving_extra`: with `fastapi` unimportable, `pytest tests/` collects
  and runs, reporting the API tests as skipped rather than failing at collection.
- `pytest_passes_with_extras`: with the `dev`, `serving`, and `mlops` extras installed,
  `pytest tests/ -q` passes and the README's stated test count equals the number it reports.
- `readme_names_the_dataset_source`: `README.md` contains the Kaggle dataset URL and the exact
  path the loader reads, `data/raw/GlobalWeatherRepository.csv`.
- `readme_separates_zero_setup_paths`: `README.md` states which commands run on a fresh clone
  without the dataset and which require it.
- `readme_has_no_tab_claim`: `README.md` does not describe the dashboard as tabbed, matching
  ADR 0003 and the `TabList` assertion in `web/scripts/check-redesign.mjs`.
- `readme_quotes_real_banner_strings`: the provenance strings quoted in `README.md` appear
  verbatim in `web/components/DataStatusBanner.tsx`.
- `readme_does_not_recommend_destructive_export`: `README.md` does not present
  `python -m weather_forecast.dashboard_export` as a way to regenerate the real contract, since
  its CLI accepts only `--data-status sample` and defaults its output to `web/public/data`.
- `web_gates_pass`: `npm run build`, `npm run check`, and `npm test` all pass in `web/`.
- `lint_and_types_pass`: `ruff check .`, `ruff format --check .`, and `mypy src/` all pass.

## Reproducibility

Python 3.12.13, in a clean virtual environment at the repository root:

```bash
pip install -e ".[dev,serving,mlops]"
pytest tests/ -q
ruff check . && ruff format --check . && mypy src/
```

Dashboard, from `web/` with Node.js 25.2.1 and npm 11.6.2:

```bash
npm ci
npm run build
npm run check
npm test
```

The training CLI, the drift CLI, and the notebooks are not reproducible without the source CSV
at `data/raw/GlobalWeatherRepository.csv`; the published Results table is instead checked
against the committed `web/public/data/metrics.json` and `web/public/data/anomalies.json`.

## Risks and Assumptions

- Assumption: the source dataset is the Kaggle "World Weather Repository (Daily Updating)"
  dataset by `nelgiriyewithana`, whose column names match those `data_loader.py` and
  `anomaly.py` require. Verified against the dataset page; the download's file name is not
  asserted, so the README tells the reader the path to save it to.
- Assumption: the reader installs into a virtual environment on Python 3.10 or newer, as the
  pinned dependencies require.
- Risk: the committed data contract was generated 122 commits before the current `main`, so the
  README's Results table reflects that snapshot rather than a re-run. Mitigation: the snapshot
  and its regeneration procedure are recorded under Known Issues, and no README number is stated
  that the committed contract does not contain.
- Risk: adding the `importorskip` guard means a reader without the `serving` extra sees the API
  tests skipped instead of failing loudly. Mitigation: the README documents the install that
  runs the full suite, and CI installs the `serving` extra, so the API tests always run there.
