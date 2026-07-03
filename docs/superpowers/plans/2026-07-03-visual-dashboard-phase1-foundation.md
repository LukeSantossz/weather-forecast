# Visual Dashboard Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Note: this repo layers its own framework gates on top — each task is executed on its own branch through Spec Gate → TDD → R1/R2(Codex)/R3(CodeRabbit) → PR.

**Goal:** Establish the foundation for the phase-1 static dashboard — prove the Astryx+Next static-export stack works, lock the design language, and build the tested Python data contract — so the front build (Plan 2) can be written placeholder-free.

**Architecture:** A `web/` Next.js `output:'export'` app styled by Astryx pre-compiled CSS (proven by a spike). A Python export module in `src/` owns a JSON data contract (5 files + JSON Schemas); the front will only render it. Honesty states live in the data.

**Tech Stack:** Python 3.10+ (pandas, jsonschema), Next.js (static export), Astryx `@astryxdesign/core` v0.1.2 pre-compiled CSS, Node LTS. Tests: pytest (Python), `next build` smoke (front).

## Global Constraints

- Astryx pinned EXACTLY to `0.1.2` (no `^`); lockfile committed. Astryx imports only in `web/components/`.
- Astryx APIs come ONLY from the archived CLI manifest / MCP (Task 1 output) — never guessed (post training-cutoff).
- Next.js uses `output: 'export'` (fully static); no SSR/serverless in phase 1.
- Data contract: Python is the sole writer; the front never derives data. Swapping sample→real changes zero files under `web/`.
- Every JSON file carries `schema_version`, `generated_at`, `data_status: "sample" | "real"`. Every metric row carries `status: "final" | "pending_rerun"`. The value 0.19 must NOT appear in any committed artifact.
- Framing verbatim: forecast granularity is `"daily_global_mean"` (never "per-country"); SHAP `target` is `"pm2_5"` (never "temperature").
- All identifiers/comments/docs in English. Conventional Commits, no AI-attribution lines.
- `web/node_modules` excluded from OneDrive sync before front work.

---

### Task 1: Static-export compatibility spike (BLOCKING GATE) — Opus

Exploratory gate, not a permanent deliverable. Proves the stack and archives the real Astryx API. If it fails, STOP and surface the fallback to the owner (keep Next/Vercel, restyle with plain CSS).

**Files:**
- Create: `web/` (Next.js scaffold), `web/next.config.js` (`output: 'export'`), `web/package.json` (+ committed lockfile)
- Create: `docs/specs/astryx-manifest-0.1.2.json` (archived CLI manifest)
- Modify: root `.gitignore` (add `web/node_modules`, `web/out`, `web/.next`)

**Interfaces:**
- Produces: a working `web/` static scaffold and the archived Astryx component manifest that Task 2 and Plan 2 consume for real component names/props.

- [ ] **Step 1: Confirm OneDrive exclusion** — verify `web/node_modules` will not sync (owner action or `.gitignore` + local exclusion). Do not proceed to `npm install` inside a live-synced folder.
- [ ] **Step 2: Scaffold Next.js static export** — create a minimal Next app in `web/` with `next.config.js` setting `output: 'export'` and `images.unoptimized: true`. Add `web/node_modules`, `web/out`, `web/.next` to root `.gitignore`.
- [ ] **Step 3: Install pinned Astryx** — `cd web && npm install @astryxdesign/core@0.1.2 @astryxdesign/theme-neutral@0.1.2` (exact, no `^`). Commit the lockfile. If these exact package names/versions differ from the manifest, use the manifest's — do not guess.
- [ ] **Step 4: Archive the real API** — run the Astryx CLI component/manifest command (e.g. `npx astryx component --list` / manifest export per the CLI's `--help`) and save its JSON to `docs/specs/astryx-manifest-0.1.2.json`. This is the authoritative API for all later component work.
- [ ] **Step 5: Render 3 representative components** — using ONLY names/props from the archived manifest, render a tabs control, a table, and a card on one page, importing Astryx's pre-compiled CSS and one theme (per the manifest's documented pre-compiled-CSS setup).
- [ ] **Step 6: Build static** — `cd web && npm run build`. Expected: `next build` completes, emits `web/out/` with static HTML, no compiler errors.
- [ ] **Step 7: Serve and verify** — serve `web/out/` with a static server (`npx serve web/out`). Expected: page renders, the 3 components display, dark mode toggles, browser console shows zero errors.
- [ ] **Step 8: GATE DECISION** — PASS (all of step 6-7 hold) → commit the scaffold + manifest (`chore(web): scaffold static Next.js + Astryx spike`) and proceed to Task 2. FAIL → STOP, write up exactly what failed, and surface to the owner with the plain-CSS fallback. Do not attempt component work past a failed gate.

---

### Task 2: Design-language lock — Opus

Produces a locked visual identity + dataviz spec (a design artifact, not code). No TDD cycle; the deliverable is a signed-off spec the owner approves.

**Files:**
- Create: design spec under the design skill's output location (e.g. `.ulpi/design/` or `docs/superpowers/design/visual-dashboard.md`), plus a short `web/DESIGN.md` pointer.

**Interfaces:**
- Produces: the locked palette, type scale, layout system, component briefs for the 3 sections, and the chart specs (types, colors, axes) that Plan 2's components implement.

- [ ] **Step 1: Invoke `frontend-design-ui-ux`** with the brief: portfolio-leaning, anti-AI-slop, clarity-first; three sections (global forecast, MapLibre point-map anomalies, PM2.5 SHAP); must compose with Astryx themes (from the Task 1 manifest); light + dark.
- [ ] **Step 2: Invoke `dataviz`** to specify the chart marks: forecast line (history/actual/model series), metrics table with `pending_rerun` badge treatment, anomaly map point styling by method, SHAP importance bar + beeswarm. Pin a colorblind-safe categorical palette and the sample/pending badge styles.
- [ ] **Step 3: Owner sign-off** — present the locked identity + chart specs; get explicit approval. This is a human gate. On approval, commit (`docs(web): lock visual design language and dataviz spec`).

---

### Task 3: Data contract — JSON Schemas + Python sample export (TDD) — Sonnet after Spec Gate

Fully specifiable now. Produces the contract the front renders and phase-1.5 fills with real data.

**Files:**
- Create: `web/public/data/schema/{meta,forecast,metrics,anomalies,shap}.schema.json`
- Create: `src/dashboard_export.py`
- Create: `web/public/data/{meta,forecast,metrics,anomalies,shap}.json` (the committed labeled sample)
- Test: `tests/test_dashboard_export.py`
- Modify: `requirements.txt` (add `jsonschema`)

**Interfaces:**
- Produces (public functions in `src/dashboard_export.py`):
  - `build_meta(data_status: str = "sample") -> dict`
  - `build_forecast(data_status: str = "sample") -> dict`
  - `build_metrics(data_status: str = "sample") -> dict`
  - `build_anomalies(data_status: str = "sample") -> dict`
  - `build_shap(data_status: str = "sample") -> dict`
  - `write_contract(out_dir: pathlib.Path, data_status: str = "sample") -> list[pathlib.Path]`
  - `validate(section: str, data: dict) -> None` (raises `jsonschema.ValidationError`)
- Consumes: nothing (deterministic sample generator; the real-data reader is phase 1.5).

- [ ] **Step 1: Add dependency** — append `jsonschema` to `requirements.txt`; `./.venv/Scripts/pip install jsonschema`. Commit (`build(deps): add jsonschema for the dashboard data contract`).
- [ ] **Step 2: Write the 5 JSON Schemas** — draft-2020-12 schemas encoding the SPEC 0006 Data Contract. Each `required`: `schema_version`, `generated_at`, `data_status` (enum `["sample","real"]`). Key constraints: `forecast.series.granularity` const `"daily_global_mean"`; `metrics.models[].status` enum `["final","pending_rerun"]`; `shap.target` const `"pm2_5"`; `anomalies.records[].detected_by` enum `["zscore","isolation_forest","both"]`. Commit (`feat(web): add JSON Schemas for the dashboard data contract`).
- [ ] **Step 3: Write the failing test for `build_metrics`**

```python
# tests/test_dashboard_export.py
import json, pathlib
import jsonschema
from src.dashboard_export import build_metrics, validate

def test_build_metrics_marks_leakage_models_pending_and_hides_019():
    data = build_metrics()
    by_id = {m["id"]: m for m in data["models"]}
    assert by_id["sarima"]["status"] == "final"
    assert by_id["lightgbm"]["status"] == "pending_rerun"
    assert by_id["lightgbm"]["rmse_c"] is None
    # the retracted value must never appear anywhere in the artifact
    assert "0.19" not in json.dumps(data)
    validate("metrics", data)  # schema-valid
```

- [ ] **Step 4: Run it, expect fail** — `./.venv/Scripts/python -m pytest tests/test_dashboard_export.py -k metrics -q`. Expected: FAIL (`build_metrics` not defined).
- [ ] **Step 5: Implement `build_metrics` + `validate`** — `validate` loads `web/public/data/schema/<section>.schema.json` and calls `jsonschema.validate`. `build_metrics` returns the 7-model table with Prophet/ARIMA/SARIMA `status:"final"` (values from README Results) and LightGBM/GB/ensemble `status:"pending_rerun"`, all leakage-affected numeric fields `None`, plus a `caveats` note referencing #20. No literal `0.19` anywhere.
- [ ] **Step 6: Run it, expect pass** — same command. Expected: PASS.
- [ ] **Step 7: Repeat the red-green cycle for `build_meta`, `build_forecast`, `build_anomalies`, `build_shap`** — one failing test each asserting: schema-valid; `data_status=="sample"`; `forecast` `granularity=="daily_global_mean"` with `history/actual/models[].predictions` present; `anomalies` method counts (930/2667/219) + `records[]` schema-valid; `shap` `target=="pm2_5"` with `features[]` and downsampled `beeswarm[]`. Implement each minimally to pass.
- [ ] **Step 8: Write the failing test for `write_contract`**

```python
def test_write_contract_emits_five_labeled_files(tmp_path):
    paths = write_contract(tmp_path)
    names = sorted(p.name for p in paths)
    assert names == ["anomalies.json","forecast.json","meta.json","metrics.json","shap.json"]
    for p in paths:
        obj = json.loads(p.read_text())
        assert obj["data_status"] == "sample"
        validate(p.stem, obj)
```

- [ ] **Step 9: Implement `write_contract`** — builds all 5, validates each, writes to `out_dir`. Run the test, expect PASS.
- [ ] **Step 10: Generate the committed sample + add a CLI** — add `if __name__ == "__main__"` argparse (`--out`, `--data-status`); run `./.venv/Scripts/python -m src.dashboard_export --out web/public/data` to write the committed sample. Add a test that loads each committed `web/public/data/*.json` and asserts it validates against its schema.
- [ ] **Step 11: Commit** — `feat(web): add python data-contract export with schema-validated sample`.

---

### Task 4: Contract CI (path-scoped) — Sonnet

**Files:**
- Modify: `.github/workflows/ci.yml` (add a job or step)

**Interfaces:**
- Consumes: the schemas + sample from Task 3; the `web/` build from Task 1.

- [ ] **Step 1: Add a contract-validation step** — a CI step running `python -m pytest tests/test_dashboard_export.py -q` (installs `jsonschema`). This fails CI if the committed sample drifts from the schemas.
- [ ] **Step 2: Add a path-scoped front-build job** — a job triggered on changes under `web/**` that runs `cd web && npm ci && npm run build` on Node LTS, asserting the static export builds. Keep it separate from the Python matrix so the toolchains don't entangle.
- [ ] **Step 3: Commit** — `ci(web): validate data contract and static build`.

---

## Deferred to Plan 2 (Front build) — written after Task 1 + Task 2

Once the spike passes and the manifest + design language exist, Plan 2 covers, placeholder-free: the front data layer (TS types mirroring the contract + loader), the three section components (global forecast chart, MapLibre point map, PM2.5 SHAP), honesty badges, and the Vercel static deploy. It cannot be written now without guessing the Astryx API — that would violate the no-placeholder rule.

## Self-Review

- **Spec coverage:** Spike (SPEC risks/gate) ✓; design-lock (SPEC skills) ✓; data contract + honesty states + framing (SPEC Data Contract/ADR-D/ADR-E) ✓; CI validation (SPEC scope) ✓. Front sections + deploy → Plan 2 (explicitly deferred, not dropped) ✓.
- **Placeholder scan:** Astryx component code is intentionally deferred to the archived manifest (a principled deferral, not laziness) and front detail to Plan 2. Python tasks carry concrete code.
- **Type consistency:** `build_*`/`write_contract`/`validate` signatures are used consistently across tasks; section names (`meta/forecast/metrics/anomalies/shap`) match schemas, files, and `validate(section, ...)`.
