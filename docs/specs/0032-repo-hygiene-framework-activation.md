# SPEC: chore(repo): repo hygiene cleanup and .standards framework activation

Foundation sub-project (SP0) of the "make the project usable" effort. It introduces no
new product behavior: it removes dead and duplicated code, deletes orphaned reference
artifacts, and finishes wiring the `.standards` framework that the repository already
declares as binding. It is the clean, conformant base the later interactive sub-projects
(SP1 browser-inference core, SP2 forecast studio, SP3 ZKML, SP4 deploy) build on. The
Python pipeline, the JSON data contract, and the shipped dashboard behavior are unchanged;
every change here is a refactor, a deletion, a documentation edit, or a CI/tooling wiring.

## Problem

The repository presents well but is not yet clean or fully conformant: it carries dead and
duplicated code, orphaned reference files, and a framework that is declared but only
partially activated.

Concretely, verified against the current tree:

- `_daily_from_raw` is copy-pasted near-identically in `src/weather_forecast/train.py:113`
  and `src/weather_forecast/drift.py:103`; each copy is used only by its own module.
- `chronological_split` (`src/weather_forecast/models.py:47`) has no caller anywhere in
  `src/`, `notebooks/`, or `scripts/` (only its own test); it was superseded by
  `carve_validation_tail`.
- `transform_numeric_features` (`src/weather_forecast/preprocessing.py:162`) and
  `align_to_encoded_columns` (`src/weather_forecast/preprocessing.py:228`) have no caller
  anywhere either (only their own tests): they are the transform/inference counterparts of
  `normalize_numeric_features` and `encode_categorical_features`, but `run_preprocessing_pipeline`
  uses only the fit versions, and no inference path consumes the transform versions. Verified
  that neither the forecast path (`train.py` uses `create_features`, not `preprocessing`) nor
  the anomaly path (`anomaly.py` uses raw features plus `StandardScaler`) nor any planned
  interactive sub-project uses them, so they are dead, not scaffolding.
- `loadMeta` (`web/lib/contract.ts:204`) is exported but never called; `meta` is consumed
  by direct JSON import in `web/app/layout.tsx` and `web/components/DataStatusBanner.tsx`.
- `web/scripts/check-redesign.mjs` is a working acceptance-criteria gate that is not wired
  into `web/package.json` or CI, so it only ever runs by hand.
- `docs/design/observatory-preview.html` and
  `docs/design/observatory-preview-template.html` are superseded mockups from the completed
  redesign; the owner has decided they carry no ongoing value, yet they are cited as a
  "ported from" source of truth in about fifteen places in shipped code and docs
  (`web/app/theme.css`, eleven `web/components/**` files, `.ulpi/design/DESIGN.md`, and the
  completed plan `docs/superpowers/plans/2026-07-05-observatory-visual-redesign.md`).
- The `.standards` framework is declared binding by `CLAUDE.md` but not fully activated:
  `core.hooksPath` is unset (the R2 pre-push gate never runs), there is no root
  `CONTEXT.md` domain glossary, the `docs/adr/` entries created in the previous task are
  lettered (`adr-f/g/h`) instead of the framework's numbered convention and there is no
  `0001-decision-records-flow.md` seed, and the README "Engineering Decisions" section
  restates rationale inline instead of indexing ADRs as `github.md` requires.

## Design Decision

Do the cleanup and the framework activation together as one foundation pass, because they
touch the same surfaces (docs, ADRs, README, CI) and both must be true before the
interactive work starts on a trustworthy base.

Code hygiene: extract the duplicated daily-series logic into one shared public helper
`daily_global_mean(project_root)` in `data_loader.py` (its natural home, alongside
`load_raw_weather`) and have `train.py` and `drift.py` import it; delete the three dead
functions `chronological_split`, `transform_numeric_features`, and `align_to_encoded_columns`
with their tests; delete `loadMeta`; delete both preview HTML files and rewrite every reference
to them so no dangling path remains (comment/doc-only, keeping the substantive note and
dropping the file path); and wire `check-redesign.mjs` into `web/package.json` and the web
CI so the redesign guard runs automatically. The interactive sub-projects do not resurrect
`transform_numeric_features`/`align_to_encoded_columns`: SP1's anomaly checker exercises the
raw five-feature Isolation Forest path in `anomaly.py`, and SP2's forecast studio reimplements
`create_features` (lag/rolling/calendar) in JS, so neither touches `preprocessing.py`'s
transform path. The `preprocessing.py` module keeps its fit functions and pipeline; only the
two never-wired transform counterparts are removed.

Framework activation: add a root `CONTEXT.md` domain glossary; add a committed setup step
that points Git at `.githooks` and document it in `CONTRIBUTING.md`, and activate it in this
working copy; reconcile the ADR archive to the framework's numbered convention (seed
`0001-decision-records-flow.md`, renumber the observatory ADRs to `0002/0003/0004`, and
backfill the significant standing engineering decisions as numbered ADRs from `0005`); and
rewrite the README "Engineering Decisions" section as an index whose every row links a real
ADR file.

## Architecture Decisions

This sub-project introduces no new hard-to-reverse design decision of its own that needs an
ADR. Its ADR-facing work is the reverse: it *promotes* decisions that already exist (the
observatory identity trio, and the standing engineering decisions currently restated in the
README) into durable, numbered records under `docs/adr/`, and seeds the decision-records
flow. Those ADRs record existing rationale faithfully from the README and SPEC 0006; they do
not invent new rationale.

## Scope

- **Includes:**
  - Extract `daily_global_mean(project_root)` into `src/weather_forecast/data_loader.py`,
    export it from `__init__.py`, and replace both `_daily_from_raw` copies with imports; add
    a unit test for the helper.
  - Delete the three dead functions and their tests: `chronological_split` from `models.py`,
    and `transform_numeric_features` and `align_to_encoded_columns` from `preprocessing.py`
    (leaving the fit functions `normalize_numeric_features`/`encode_categorical_features` and
    `run_preprocessing_pipeline` untouched).
  - Delete `loadMeta` from `web/lib/contract.ts`.
  - Delete `docs/design/observatory-preview.html` and
    `docs/design/observatory-preview-template.html`, and rewrite every reference to them
    (the code comments and docs enumerated in Problem) to remove the dangling path while
    keeping the substantive note; leave `web/` runtime behavior unchanged.
  - Add a `check` script to `web/package.json` that runs `node scripts/check-redesign.mjs`,
    and add a step to the web CI workflow that runs it after the build.
  - Add a root `CONTEXT.md` domain glossary covering the project's ubiquitous language
    (global daily-mean temperature series, holdout evaluation, z-score / Isolation Forest
    anomaly methods and their overlap, the inverse-RMSE weighted ensemble, sample/real data
    provenance, and the SHAP driver reading).
  - Add a committed setup step (a `scripts/` setup entry) that runs
    `git config core.hooksPath .githooks`, document it in `CONTRIBUTING.md`, and activate it
    in this working copy so the R2 pre-push gate is live (Codex CLI absent is a graceful skip).
  - Create `docs/adr/0001-decision-records-flow.md`; renumber `adr-f/g/h-*.md` to
    `0002/0003/0004-*.md`; backfill the significant standing engineering decisions (the
    README table: IQR clipping, Parquet processed store, the column-candidates loader
    pattern, the direct-PyArrow engine choice, lag/rolling features, and the inverse-RMSE
    weighted ensemble) as numbered ADRs from `0005`.
  - Rewrite the README "Engineering Decisions" section as an index whose every row links an
    existing `docs/adr/` file.
- **Does NOT include:**
  - Any change to the Python pipeline's numerical behavior, the data contract
    (`web/public/data/*` and its schemas), or the model set; the committed data is not
    regenerated.
  - Touching the preprocessing fit functions or `run_preprocessing_pipeline`, or the
    `create_features` forecast path (SP2 reimplements feature engineering in JS, not in Python).
  - Any interactive feature, browser inference, ZKML, or deployment (SP1-SP4).
  - Backfilling SPEC 0006's ADR-A..E inline records beyond what the README table needs.
  - Changing the Astryx components, the dashboard's visual identity, or the semantic search.

## Acceptance Criteria

- `daily_series_logic_defined_once`: `daily_global_mean` is defined exactly once (in
  `data_loader.py`) and exported from `__init__.py`; `git grep "_daily_from_raw" -- src/`
  returns no hits; `train.py` and `drift.py` import the shared helper; its new unit test and
  the existing `train`/`drift` tests pass.
- `dead_functions_removed`: `git grep -E "chronological_split|transform_numeric_features|align_to_encoded_columns" -- src/`
  returns no hits; the full pytest suite passes with their tests removed and no import errors;
  `run_preprocessing_pipeline` and the preprocessing fit functions remain and their tests pass.
- `no_orphaned_preview_references`: both preview HTML files are deleted and
  `git grep "observatory-preview" -- web/ .ulpi/ docs/superpowers/` returns zero hits (the
  code and design surfaces that cited them; this SPEC and any ADR that names the removal are
  not code references); `cd web && npm run build` still succeeds.
- `loadMeta_removed`: `loadMeta` is absent from `web/lib/contract.ts` and the web build
  passes with no unresolved reference.
- `redesign_check_runs_in_ci`: `web/package.json` exposes a `check` script running
  `check-redesign.mjs`, the web CI workflow runs it after the build, and the job passes on
  this branch.
- `context_md_present`: a root `CONTEXT.md` exists, defines the domain terms listed in
  Scope, and every term it cross-references resolves.
- `hooks_gate_activatable`: a committed setup step sets `core.hooksPath` to `.githooks`,
  `CONTRIBUTING.md` documents it, and after running it `git config --get core.hooksPath`
  returns `.githooks` in this working copy.
- `adrs_numbered_and_seeded`: `docs/adr/` contains `0001-decision-records-flow.md` and
  sequential numbered ADRs; no lettered `adr-*.md` file remains.
- `readme_decisions_index_adrs`: every row of the README "Engineering Decisions" section
  links a `docs/adr/` file that exists, with at least three rows.
- `no_behavior_regression`: the full pytest suite, `cd web && npm run build`, the web CI
  lint, and `check-redesign.mjs` all pass; the data contract files are byte-identical to
  their pre-change state.

## Reproducibility

- Python: `pip install -e .[dev]` then `pytest` (the suite, including the new
  `daily_global_mean` test, passes; `chronological_split`'s test is gone).
- Front: `cd web && npm ci && npm run build && npm run check` (build exports statically and
  the redesign check passes).
- Hygiene checks (scoped to code/design surfaces, since this SPEC and the new ADRs name the
  removed symbols): `git grep "_daily_from_raw" -- src/`,
  `git grep "observatory-preview" -- web/ .ulpi/ docs/superpowers/`, and
  `git grep "loadMeta" -- web/` each return no hits; `git config --get core.hooksPath`
  returns `.githooks` after setup.
- Data unchanged: `git diff --stat main -- web/public/data` is empty.

## Risks and Assumptions

- Assumption: the removed symbols (`chronological_split`, `transform_numeric_features`,
  `align_to_encoded_columns`, `loadMeta`) and the preview HTMLs have no external consumer. This
  is a portfolio repository, not a published library or a site others deep-link into, and it
  was verified that no `src/`, `notebooks/`, `scripts/`, or `web/` path uses them outside their
  own tests, so removing them is safe. The `preprocessing.py` fit API and pipeline stay; only
  the two never-wired transform counterparts go.
- Risk: rewriting ~13 reference comments touches many `web/` files. Mitigation: the edits are
  comment/doc-only with no behavior change, and `no_behavior_regression` (build + tests +
  data-contract byte-identity) guards against accidental logic edits.
- Risk: `core.hooksPath` is per-clone local Git config, so it cannot be committed directly.
  Mitigation: the committed artifact is the setup step plus `CONTRIBUTING.md` documentation;
  a fresh clone activates the gate by running setup, exactly as the framework intends.
- Assumption: backfilling standing decisions as ADRs is faithful recording, not
  reinterpretation; each ADR cites the README/SPEC 0006 text it formalizes.

## Alternatives Considered

- **Keep the preview HTMLs as historical reference.** Rejected: the owner judged they carry
  no ongoing value, and they currently orphan-cite from shipped code, so keeping them
  perpetuates the exact broken-reference cruft this pass removes.
- **Wire `loadMeta` into the app instead of deleting it.** Rejected: more churn for no gain;
  the direct JSON import is the established, working pattern for `meta`.
- **Delete `check-redesign.mjs` instead of wiring it.** Rejected: it is a useful,
  already-written acceptance gate; wiring it into CI keeps the redesign guarantees live.
- **Minimal ADR reconciliation (seed plus the observatory trio only, no backfill).**
  Rejected: it leaves the README "Engineering Decisions" section linking only presentation
  ADRs while the substantive ML decisions stay unrecorded, which does not satisfy the
  `github.md` norm and is not the full activation the owner asked for.
- **Do the hygiene now and defer framework activation.** Rejected: the owner asked for full
  `.standards` conformance, and doing both together avoids a second pass over the same docs,
  README, and CI surfaces.
