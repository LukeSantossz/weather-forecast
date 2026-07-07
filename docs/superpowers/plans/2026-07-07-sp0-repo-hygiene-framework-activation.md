# SP0 Repo Hygiene and Framework Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead and duplicated code, delete orphaned reference artifacts, and fully activate the `.standards` framework, with zero change to pipeline behavior and a byte-identical data contract.

**Architecture:** Two workstreams on one branch (`chore/repo-hygiene-framework-activation`): (A) Python/web code hygiene (a shared daily-series helper, deletions of unused symbols, deletion of two mockups with their references, and a CI wiring), and (B) documentation/tooling activation (`CONTEXT.md`, the Git pre-push hook, a numbered ADR archive, and a README decision index). No pipeline numerical behavior changes.

**Tech Stack:** Python 3.10/3.11 + pytest; Next.js static export (`web/`) with npm; GitHub Actions CI; Markdown docs; the pinned `.standards` submodule.

## Global Constraints

- No change to the pipeline's numerical behavior, the model set, or the data contract; `git diff --stat main -- web/public/data` must stay empty. (spec Scope)
- All output in English. (`.standards` System Rules)
- No em-dashes in docs or UI copy; use hyphens. (house rule)
- Conventional Commits for every commit; imperative, lowercase, no trailing period. (`.standards/github.md`)
- TDD red-green-refactor: write the failing check first where a check exists. (`.standards` code_conventions)
- The `preprocessing.py` fit API (`normalize_numeric_features`, `encode_categorical_features`) and `run_preprocessing_pipeline` stay; only the two never-wired transform counterparts are removed. (spec Scope)
- Grep-based acceptance checks are scoped to code/design dirs (`src/`, `web/`, `.ulpi/`, `docs/superpowers/`), since the spec and new ADRs legitimately name the removed symbols. (spec Acceptance Criteria)

---

### Task 1: Extract the shared `daily_global_mean` helper (dedupe `_daily_from_raw`)

**Files:**
- Modify: `src/weather_forecast/data_loader.py` (add the helper after `load_raw_weather`)
- Modify: `src/weather_forecast/__init__.py` (export it)
- Modify: `src/weather_forecast/train.py:113-121` (remove local `_daily_from_raw`, import the helper, update the one call at `train.py:164`)
- Modify: `src/weather_forecast/drift.py:103-110` (remove local `_daily_from_raw`, import the helper, update the one call at `drift.py:130`)
- Test: `tests/test_data_loader.py` (add a test class)

**Interfaces:**
- Produces: `daily_global_mean(project_root: Path) -> pd.DataFrame` returning a frame with columns `["ds", "y"]`, one row per calendar day, `ds` datetime-normalized and ascending, `y` the mean `temperature_celsius` for that day. Exported from `weather_forecast`.
- Consumes: `load_raw_weather(project_root)` (existing).

- [ ] **Step 1: Write the failing test**

Add to `tests/test_data_loader.py`:

```python
class TestDailyGlobalMean:
    """Tests for daily_global_mean."""

    def test_averages_temperature_per_day_sorted(self, monkeypatch) -> None:
        raw = pd.DataFrame(
            {
                "last_updated": pd.to_datetime(
                    ["2024-01-02 06:00", "2024-01-02 18:00", "2024-01-01 12:00"]
                ),
                "temperature_celsius": [20.0, 22.0, 10.0],
            }
        )
        monkeypatch.setattr(
            "weather_forecast.data_loader.load_raw_weather", lambda project_root: raw
        )

        from weather_forecast.data_loader import daily_global_mean

        out = daily_global_mean(Path("."))

        assert list(out.columns) == ["ds", "y"]
        assert list(out["ds"]) == list(pd.to_datetime(["2024-01-01", "2024-01-02"]))
        assert out["y"].tolist() == [10.0, 21.0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_data_loader.py::TestDailyGlobalMean -v`
Expected: FAIL with `ImportError: cannot import name 'daily_global_mean'`.

- [ ] **Step 3: Add the helper to `data_loader.py`**

Append to `src/weather_forecast/data_loader.py` (canonical version, keeping the `to_datetime` reconvert from the `train.py` copy):

```python
def daily_global_mean(project_root: Path) -> pd.DataFrame:
    """Global daily-mean temperature series as a ``(ds, y)`` frame.

    Averages ``temperature_celsius`` across all rows sharing a calendar day,
    ascending by day. Shared by the forecast (``train``) and drift paths.

    Args:
        project_root: Root directory of the project.

    Returns:
        A frame with columns ``["ds", "y"]``: ``ds`` datetime-normalized and
        ascending, ``y`` the mean temperature for that day.
    """
    df = load_raw_weather(project_root)
    daily = (
        df.groupby(df["last_updated"].dt.normalize())["temperature_celsius"].mean().reset_index()
    )
    daily.columns = ["ds", "y"]
    daily["ds"] = pd.to_datetime(daily["ds"])
    return daily.sort_values("ds").reset_index(drop=True)
```

- [ ] **Step 4: Export it from `__init__.py`**

In `src/weather_forecast/__init__.py`, add `daily_global_mean` to the `data_loader` import block and to `__all__`:

```python
from .data_loader import (
    add_region_column,
    daily_global_mean,
    get_precipitation_column,
    get_temperature_column,
    load_raw_weather,
)
```

and add `"daily_global_mean",` to `__all__`.

- [ ] **Step 5: Replace the copy in `train.py`**

In `src/weather_forecast/train.py`: delete the local `def _daily_from_raw(...)` block (lines ~113-121), add `daily_global_mean` to the existing `from weather_forecast.data_loader import ...` line (currently imports `load_raw_weather`), and change the call site `daily = _daily_from_raw(args.project_root)` to `daily = daily_global_mean(args.project_root)`.

- [ ] **Step 6: Replace the copy in `drift.py`**

In `src/weather_forecast/drift.py`: delete the local `def _daily_from_raw(...)` block (lines ~103-110, including its inner `from weather_forecast.data_loader import load_raw_weather`), add a top-level `from weather_forecast.data_loader import daily_global_mean`, and change `daily = _daily_from_raw(args.project_root)` to `daily = daily_global_mean(args.project_root)`.

- [ ] **Step 7: Run tests to verify green**

Run: `pytest tests/test_data_loader.py tests/test_train.py tests/test_drift.py -v`
Expected: PASS.

- [ ] **Step 8: Verify no duplication remains**

Run: `git grep "_daily_from_raw" -- src/`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/weather_forecast/data_loader.py src/weather_forecast/__init__.py src/weather_forecast/train.py src/weather_forecast/drift.py tests/test_data_loader.py
git commit -m "refactor(pipeline): dedupe daily-series logic into daily_global_mean"
```

---

### Task 2: Remove the three dead functions and their tests

**Files:**
- Modify: `src/weather_forecast/models.py:47` (delete `chronological_split`)
- Modify: `src/weather_forecast/preprocessing.py:162,228` (delete `transform_numeric_features` and `align_to_encoded_columns`)
- Modify: `tests/test_models.py` (delete the `chronological_split` test(s))
- Modify: `tests/test_preprocessing.py` (delete the two functions' test(s))

**Interfaces:**
- Produces: nothing. Removes symbols with zero non-test callers (verified in the spec).

- [ ] **Step 1: Confirm the tests currently reference them (red baseline)**

Run: `git grep -nE "chronological_split|transform_numeric_features|align_to_encoded_columns" -- tests/`
Expected: hits only in `tests/test_models.py` and `tests/test_preprocessing.py`.

- [ ] **Step 2: Delete the functions**

- In `src/weather_forecast/models.py`, delete the entire `def chronological_split(...)` block (starts at line 47).
- In `src/weather_forecast/preprocessing.py`, delete the entire `def transform_numeric_features(...)` block (starts at line 162) and the entire `def align_to_encoded_columns(...)` block (starts at line 228). Leave `normalize_numeric_features`, `encode_categorical_features`, and `run_preprocessing_pipeline` intact.

- [ ] **Step 3: Delete the corresponding tests**

- In `tests/test_models.py`, delete every test function/class that calls `chronological_split`.
- In `tests/test_preprocessing.py`, delete every test function/class that calls `transform_numeric_features` or `align_to_encoded_columns`. Also remove those two names from the file's import statement from `weather_forecast.preprocessing`.

- [ ] **Step 4: Run the full suite**

Run: `pytest -q`
Expected: PASS with no import errors; `run_preprocessing_pipeline` and preprocessing fit tests still pass.

- [ ] **Step 5: Verify removal**

Run: `git grep -E "chronological_split|transform_numeric_features|align_to_encoded_columns" -- src/`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/weather_forecast/models.py src/weather_forecast/preprocessing.py tests/test_models.py tests/test_preprocessing.py
git commit -m "refactor(pipeline): remove three dead functions with no callers"
```

---

### Task 3: Remove the unused `loadMeta` export

**Files:**
- Modify: `web/lib/contract.ts:204` (delete `loadMeta`)

- [ ] **Step 1: Confirm it is unused**

Run: `git grep -n "loadMeta" -- web/`
Expected: exactly one hit, its definition at `web/lib/contract.ts:204`.

- [ ] **Step 2: Delete the export**

Remove the line `export const loadMeta = (): Promise<Meta> => loadSection<Meta>('meta');` from `web/lib/contract.ts`. Leave the `Meta` type and the other `loadSection`-based loaders untouched.

- [ ] **Step 3: Build to verify no dangling reference**

Run: `npm --prefix web run build`
Expected: build succeeds, TypeScript clean.

- [ ] **Step 4: Verify removal**

Run: `git grep "loadMeta" -- web/`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add web/lib/contract.ts
git commit -m "refactor(web): remove the unused loadMeta loader"
```

---

### Task 4: Delete the preview mockups and rewrite their references

**Files:**
- Delete: `docs/design/observatory-preview.html`, `docs/design/observatory-preview-template.html`
- Modify (drop the file-path phrase, keep the substantive note): `web/app/theme.css` (4 comments), the eleven `web/components/**` files that cite the template (`Hero.tsx`, `SectionHeader.tsx`, `CloseSection.tsx`, `MetricsTable.tsx`, `ForecastChart.tsx`, `ShapBar.tsx`, `anomalies/AnomaliesSection.tsx`, `anomalies/MethodStrip.tsx`, `anomalies/SemanticSearch.tsx`, `anomalies/anomalies.css`), `.ulpi/design/DESIGN.md` (2 references), `docs/superpowers/plans/2026-07-05-observatory-visual-redesign.md`

- [ ] **Step 1: Enumerate every reference (red baseline)**

Run: `git grep -n "observatory-preview" -- web/ .ulpi/ docs/superpowers/`
Expected: the full reference list to rewrite (theme.css, the components, DESIGN.md, the plan).

- [ ] **Step 2: Delete the two HTML files**

Run: `git rm docs/design/observatory-preview.html docs/design/observatory-preview-template.html`

- [ ] **Step 3: Rewrite each reference**

For every hit from Step 1, remove the dangling path while keeping the substantive note. Rewrite pattern: `ported from docs/design/observatory-preview-template.html's FORECAST CHART IIFE` becomes `ported from the approved observatory design preview's forecast-chart logic`. In `.ulpi/design/DESIGN.md`, replace `the source of truth (docs/design/observatory-preview-template.html)` with `the source of truth (the approved observatory design preview)`. In the plan doc, replace each `docs/design/observatory-preview-template.html` / `observatory-preview.html` reference with `the approved observatory design preview (now implemented in web/)`. Do not change any code, only comments and docs.

- [ ] **Step 4: Verify no orphan references and the build is clean**

Run: `git grep "observatory-preview" -- web/ .ulpi/ docs/superpowers/`
Expected: no output.
Run: `npm --prefix web run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A docs/design web/ .ulpi/design/DESIGN.md docs/superpowers/plans/2026-07-05-observatory-visual-redesign.md
git commit -m "chore(web): delete superseded preview mockups and rewrite their references"
```

---

### Task 5: Wire `check-redesign.mjs` into the web build and CI

**Files:**
- Modify: `web/package.json` (add a `check` script)
- Modify: `.github/workflows/web-ci.yml` (add a step after the build)

- [ ] **Step 1: Add the `check` script**

In `web/package.json`, add to `scripts` (after `build`):

```json
"check": "node scripts/check-redesign.mjs",
```

- [ ] **Step 2: Run it locally to confirm it passes on a fresh build**

Run: `npm --prefix web run build && npm --prefix web run check`
Expected: `redesign check passed`.

- [ ] **Step 3: Add the CI step**

In `.github/workflows/web-ci.yml`, after the `Build static export (type-checked)` step, add:

```yaml
      - name: Redesign acceptance checks
        run: npm run check
```

- [ ] **Step 4: Verify the workflow is valid YAML and the step is present**

Run: `git grep -n "npm run check" -- .github/workflows/web-ci.yml`
Expected: one hit.

- [ ] **Step 5: Commit**

```bash
git add web/package.json .github/workflows/web-ci.yml
git commit -m "ci(web): run the redesign acceptance check after the build"
```

---

### Task 6: Add the root `CONTEXT.md` domain glossary

**Files:**
- Create: `CONTEXT.md`

- [ ] **Step 1: Write `CONTEXT.md`**

Create `CONTEXT.md` at the repo root with this exact content:

```markdown
# CONTEXT: Domain Glossary

The ubiquitous language for weather-forecast. Use these terms verbatim in issues, specs,
ADRs, tests, and code; do not drift to synonyms.

## Series and evaluation

- **Global daily-mean temperature series** - the single univariate `(ds, y)` series the
  forecast targets: `temperature_celsius` averaged across all countries for each calendar day.
  Not per-country.
- **Holdout evaluation** - the final 30 days are held out as the test window and scored exactly
  once; the LightGBM early-stopping slice and the ensemble weights come from a validation tail
  carved out of the training window, never the test window.
- **RMSE / MAE / MAPE** - the reported forecast error metrics, in Celsius for RMSE and MAE.

## Forecast models

- **GradientBoosting / LightGBM** - the autoregressive ML forecasters, trained on
  `create_features` (lags of `y`, rolling mean/std on `y.shift(1)`, calendar and cyclical
  features).
- **ARIMA / SARIMA** - the classical statistical baselines (statsmodels).
- **Inverse-RMSE weighted ensemble** - combines the per-model forecasts with weights set from
  validation-set RMSEs; the simple ensemble is the row-wise mean.

## Anomalies

- **Z-score anomaly** - a temperature reading flagged by `|z| > 3` against the series population.
- **Isolation Forest anomaly** - a reading flagged by an Isolation Forest over five features
  (`temperature_celsius`, `humidity`, `wind_kph`, `pressure_mb`, `precip_mm`).
- **Overlap** - readings flagged by both methods; the highest-confidence anomalies.

## Drivers and provenance

- **SHAP driver reading** - the mean-absolute SHAP feature importances for the PM2.5
  air-quality model, surfaced as the drivers act.
- **Provenance (sample / real)** - every data artifact carries `data_status: "sample" | "real"`
  and every metric row `status: "final" | "pending_rerun"`; honesty lives in the data.
```

- [ ] **Step 2: Verify it exists**

Run: `test -f CONTEXT.md && echo present`
Expected: `present`.

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(context): add the domain glossary"
```

---

### Task 7: Activate the pre-push hook and document setup

**Files:**
- Create: `scripts/setup.sh`
- Modify: `CONTRIBUTING.md` (add a setup step)

- [ ] **Step 1: Create the setup script**

Create `scripts/setup.sh`:

```bash
#!/usr/bin/env bash
# One-time developer setup: activate the versioned Git hooks (R2 pre-push review gate).
set -euo pipefail
git config core.hooksPath .githooks
echo "core.hooksPath set to .githooks (R2 pre-push gate active; Codex CLI absent is a graceful skip)"
```

- [ ] **Step 2: Run it in this working copy**

Run: `bash scripts/setup.sh`
Expected: the confirmation line prints.

- [ ] **Step 3: Verify the config**

Run: `git config --get core.hooksPath`
Expected: `.githooks`.

- [ ] **Step 4: Document it in `CONTRIBUTING.md`**

Add a short "Setup" subsection near the top of `CONTRIBUTING.md`:

```markdown
## Setup

After cloning (with `--recurse-submodules`, or run `git submodule update --init` for
`.standards`), activate the Git hooks once:

    bash scripts/setup.sh

This sets `core.hooksPath` to `.githooks`, enabling the R2 pre-push review gate (it skips
gracefully if the Codex CLI is not installed).
```

- [ ] **Step 5: Commit**

```bash
git add scripts/setup.sh CONTRIBUTING.md
git commit -m "chore(repo): add setup script wiring the pre-push hook and document it"
```

---

### Task 8: Reconcile the ADR archive to the numbered convention

**Files:**
- Create: `docs/adr/0001-decision-records-flow.md`
- Rename: `adr-f/g/h-*.md` to `0002/0003/0004-*.md` (via `git mv`)
- Create: `docs/adr/0005-*.md` through `docs/adr/0010-*.md` (the six backfilled README decisions)
- Modify: `docs/specs/0031-observatory-visual-redesign.md` (update the three ADR filename references)

**Interfaces:**
- Produces: a numbered `docs/adr/` archive (`0001`-`0010`), each file titled `# ADR NNNN: <decision>` with `Status`, `Context`, `Decision`, `Consequences` sections, following the existing `adr-f-observatory-identity.md` structure.

- [ ] **Step 1: Create the decision-records-flow seed**

Create `docs/adr/0001-decision-records-flow.md`:

```markdown
# ADR 0001: Decision records flow

- Status: Accepted (2026-07-07).
- Source: `.standards/docs/standards/spec_method.md` and `github.md`.

## Context

The project needs one durable place for significant, hard-to-reverse decisions, distinct from
a SPEC's transient Alternatives Considered and from the README's reader-facing index.

## Decision

A SPEC's Design Decision is promoted at the Spec Gate to a numbered ADR under `docs/adr/` when
it is hard to reverse, surprising, and a real trade-off. The SPEC's Alternatives Considered
stays transient. The README Engineering Decisions section indexes the ADRs, linking each rather
than restating its rationale. ADRs are numbered sequentially (`NNNN-<slug>.md`).

## Consequences

- Rationale lives once, in the ADR; the README links it; the SPEC records the rejected options.
- ADR numbers are stable; superseded ADRs are marked, not deleted.
```

- [ ] **Step 2: Renumber the observatory ADRs**

Run:

```bash
git mv docs/adr/adr-f-observatory-identity.md docs/adr/0002-observatory-identity.md
git mv docs/adr/adr-g-single-scroll-narrative.md docs/adr/0003-single-scroll-narrative.md
git mv docs/adr/adr-h-nextfont-typography.md docs/adr/0004-nextfont-typography.md
```

Then in each renamed file, change the H1 from `# ADR-F: ...` to `# ADR 0002: ...` (and `0003`, `0004`), and update any internal cross-reference (e.g. "see ADR-F") to the numbered form.

- [ ] **Step 3: Update the SPEC 0031 references**

In `docs/specs/0031-observatory-visual-redesign.md`, update the "Promoted to `docs/adr/`" line to name the new files `0002-observatory-identity.md`, `0003-single-scroll-narrative.md`, `0004-nextfont-typography.md`.

- [ ] **Step 4: Backfill the six README decisions as ADRs**

For each row of the current README "Engineering Decisions" table, create a numbered ADR using the Step-1 structure. Source rows (decision -> alternative -> rationale, copied from the README):

- `0005-iqr-outlier-clipping.md` - IQR clipping for outliers; alt Z-score removal; preserves temporal continuity (Z-score drops whole rows, breaking the time series).
- `0006-parquet-processed-store.md` - Parquet for processed data; alt CSV; type safety, 3-5x compression, schema enforcement via PyArrow.
- `0007-column-candidates-loader.md` - column-candidates pattern in the data loader; alt hardcoded column names; handles schema variation across Kaggle dataset versions.
- `0008-pyarrow-engine-direct.md` - PyArrow engine directly; alt pandas `to_parquet` wrapper; avoids a known Jupyter kernel crash with the pandas PyArrow backend.
- `0009-lag-rolling-features.md` - lag + rolling features (1-21 days); alt raw values only; captures autoregressive structure; under leakage-free evaluation the ML models (RMSE 0.27-0.32) beat the classical baselines (0.73-0.80).
- `0010-inverse-rmse-ensemble.md` - inverse-RMSE weighted ensemble; alt simple average / single best model; risk diversification, weights from validation-set accuracy not the test set.

Each ADR: `Status: Accepted (2026-07-07)`; `Context` = the problem the row addresses; `Decision` = the chosen approach; the alternative goes in `Consequences` or a short `Alternatives` line; keep it faithful to the README wording, no new rationale invented.

- [ ] **Step 5: Verify the archive**

Run: `ls docs/adr/ && git grep -l "adr-[fgh]-" -- docs/`
Expected: files `0001`..`0010` present; the second command prints nothing (no reference to the old lettered filenames; no lettered `adr-*.md` file remains).

- [ ] **Step 6: Commit**

```bash
git add docs/adr/ docs/specs/0031-observatory-visual-redesign.md
git commit -m "docs(adr): reconcile the ADR archive to the numbered convention"
```

---

### Task 9: Rewrite the README Engineering Decisions as an ADR index

**Files:**
- Modify: `README.md` (the `## Engineering Decisions` section, lines ~79-88)

- [ ] **Step 1: Replace the table with an ADR index**

Replace the current restated-rationale table with a curated index that links the ADRs (one row per decision, linking its ADR file rather than restating the rationale):

```markdown
## Engineering Decisions

The significant, hard-to-reverse decisions, each recorded as an ADR under
[`docs/adr/`](docs/adr/) (see [ADR 0001](docs/adr/0001-decision-records-flow.md) for the flow):

| Decision | ADR |
|----------|-----|
| IQR clipping for outliers (preserves temporal continuity) | [0005](docs/adr/0005-iqr-outlier-clipping.md) |
| Parquet for the processed store (type safety, compression) | [0006](docs/adr/0006-parquet-processed-store.md) |
| Column-candidates loader (handles dataset-version drift) | [0007](docs/adr/0007-column-candidates-loader.md) |
| PyArrow engine directly (avoids a Jupyter kernel crash) | [0008](docs/adr/0008-pyarrow-engine-direct.md) |
| Lag + rolling features (captures autoregressive structure) | [0009](docs/adr/0009-lag-rolling-features.md) |
| Inverse-RMSE weighted ensemble (risk diversification) | [0010](docs/adr/0010-inverse-rmse-ensemble.md) |
| Observatory identity, single-scroll IA, self-hosted fonts | [0002](docs/adr/0002-observatory-identity.md), [0003](docs/adr/0003-single-scroll-narrative.md), [0004](docs/adr/0004-nextfont-typography.md) |
```

- [ ] **Step 2: Verify every linked ADR file exists**

Run: `for n in 0001 0002 0003 0004 0005 0006 0007 0008 0009 0010; do ls docs/adr/${n}-*.md >/dev/null || echo "MISSING $n"; done`
Expected: no `MISSING` lines.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): index the ADR archive from Engineering Decisions"
```

---

### Task 10: Full acceptance verification

**Files:** none (verification only)

- [ ] **Step 1: Python suite**

Run: `pytest -q`
Expected: PASS.

- [ ] **Step 2: Web build and checks**

Run: `npm --prefix web ci && npm --prefix web run build && npm --prefix web run check`
Expected: build succeeds, `redesign check passed`.

- [ ] **Step 3: Hygiene greps (all empty)**

Run:
```bash
git grep "_daily_from_raw" -- src/
git grep -E "chronological_split|transform_numeric_features|align_to_encoded_columns" -- src/
git grep "loadMeta" -- web/
git grep "observatory-preview" -- web/ .ulpi/ docs/superpowers/
```
Expected: no output from any.

- [ ] **Step 4: Framework activation checks**

Run:
```bash
test -f CONTEXT.md && echo context-ok
git config --get core.hooksPath
ls docs/adr/0001-*.md docs/adr/0010-*.md
```
Expected: `context-ok`; `.githooks`; both ADR files listed.

- [ ] **Step 5: Data contract byte-identity**

Run: `git diff --stat main -- web/public/data`
Expected: no output (empty).

- [ ] **Step 6: Open the PR**

Write the PR body following `.standards/docs/standards/github.md` PR model (sections: Context, What Was Done, How to Test, Evidence, PR Review Checklist), drawing Context/What from spec 0032 and Evidence from the Step 1-5 command outputs. Save it to a temp file and:

```bash
git push -u origin chore/repo-hygiene-framework-activation
gh pr create --base main --title "chore(repo): repo hygiene cleanup and .standards framework activation" --body-file /tmp/sp0-pr-body.md
```

Stop here for the owner's review of the PR.
