# SPEC: feat(web): browser-side inference core and a live anomaly checker

First interactive sub-project (SP1) of the "make the project usable" effort, built on the
SP0 clean base (`docs/specs/0032-repo-hygiene-framework-activation.md`). It turns the
read-only Anomalies act into something the visitor operates: a slider laboratory where they
dial a hypothetical weather observation and watch both anomaly methods judge it live, entirely
in the browser with no backend and no network call after load. It also lays the reusable
client-side inference foundation (Python-owned model export, a JS tree-traversal engine, and a
feature-parity harness) that SP2's forecast studio will extend. It changes no pipeline
numerical behavior and no existing data contract file; it adds one new contract artifact and a
new interactive component.

## Problem

The dashboard demonstrates anomaly detection but the visitor cannot exercise it. The
Anomalies act shows a fixed map of 150 precomputed anomalies, a method-count trio, and an
offline semantic search over those records, but there is no way to ask "would *this* reading be
flagged?" The project's own methods answer exactly that question: `zscore_anomalies` judges a
temperature against the series population (`|z| > 3`), and `isolation_forest_anomalies` judges
a five-feature observation (`temperature_celsius, humidity, wind_kph, pressure_mb, precip_mm`)
against a fitted Isolation Forest. Both run today only in Python, at build time, over the fixed
dataset. Nothing lets a visitor supply an observation and see the verdict, so the strongest
"this is a working system, not a slideshow" signal is absent.

Separately, the project has no client-side inference capability at all, which every later
interactive sub-project needs. SP1 must therefore build the foundation once, correctly, and
prove it on the cheapest live action (the anomaly checker) before SP2 takes on the harder
forecast models.

## Design Decision

Ship a live anomaly checker driven by a five-slider observation panel inside the Anomalies act,
and back it with a small, reusable browser-inference core. Python stays the owner of the model
(ADR-D): a build-time exporter fits the anomaly models on the committed data and serializes
everything the browser needs to infer into a new contract file
`web/public/data/anomaly_model.json` (with a JSON Schema and validation, like the other
contract files). The browser never trains; it loads the artifact and runs a pure,
dependency-free TypeScript inference module.

The exported artifact carries: the z-score baseline (`mu`, `sigma`) of the temperature series;
the `StandardScaler` parameters (`mean`, `scale`) and median fill values for the five
Isolation Forest features; the Isolation Forest as an array of trees (`feature`, `threshold`,
`children_left`, `children_right`, `n_node_samples` per node); the `c(max_samples)` average
path-length normalization constant; and the fitted `offset_` scalar. The TypeScript module
reproduces `score_samples` exactly (per-tree path length with the `_average_path_length`
correction at truncated leaves, averaged across trees, normalized by `c(n)`), derives the
predict verdict as `score < offset_`, and computes the z-score verdict directly. `offset_` is
always taken from the export, never recomputed in JS. A golden-vector parity test locks JS
output to the Python reference within a documented tolerance.

The UI presents five sliders (temperature plus the four weather variables) and updates, on
every change, three read-outs: the z-score verdict on the temperature, the Isolation Forest
verdict and score on all five features, and an overlap badge when both agree (the dashboard's
"highest-confidence" framing). A "place on the map" action lets the visitor click the existing
MapLibre map to give the imagined observation a location; the point renders with the same
encoding (colour = temperature, shape = the method that flagged it), and copy states plainly
that the location is only context and the model judges the weather values, not the place.

## Architecture Decisions

Two decisions here are hard to reverse and are promoted to numbered ADRs under `docs/adr/` at
the Spec Gate:

- **ADR (browser inference by exported artifact).** Client-side inference is done by
  exporting fitted models from Python into a versioned contract artifact and running a pure-TS
  engine over it, not by calling a backend and not by training in the browser. Preserves ADR-D
  (Python owns the contract): swapping the data and re-exporting changes no `.ts` logic.
  Rationale: it keeps the app a static export, keeps training authority in Python, and gives a
  genuine, inspectable client-side computation.
- **ADR (tree-traversal as the shared inference primitive).** The binary tree-traversal
  routine is written once as the reusable core; the Isolation Forest path-length scorer is the
  first consumer, and SP2's gradient-boosting leaf-value scorer is the second. Rationale: one
  tested primitive underlies every tree model the project serves client-side.

## Scope

- **Includes:**
  - A Python exporter (a new function following `dashboard_export.py`'s real/sample pattern)
    that fits the anomaly models on the committed data and writes `web/public/data/anomaly_model.json`
    plus its JSON Schema under `web/public/data/schema/`, and validation that the sample
    conforms.
  - A pure TypeScript inference module: the shared tree-traversal primitive, the Isolation
    Forest `score_samples` reproduction and predict verdict, and the z-score verdict.
  - A front-end test runner in `web/` (the project has none today: `package.json` exposes only
    `dev`/`build`/`preview`), wired into `web/package.json` as `test` and run in the web CI, to
    host the parity and inference-module tests.
  - A feature-parity module (median-fill + `StandardScaler`) with a golden-vector test whose
    reference vectors are generated from Python and committed as fixtures.
  - A parity test asserting JS `score_samples` matches the Python reference within tolerance
    for a fixed set of inputs.
  - A live anomaly-checker component in the Anomalies act: five sliders, three live read-outs
    (z-score, Isolation Forest, overlap), keyboard-reachable with visible focus, respecting
    `prefers-reduced-motion`, with table/text equivalents for the verdicts.
  - The "place on the map" interaction: click-to-locate on the existing MapLibre map, the
    synthetic point rendered with the standard encoding, and the context-only copy.
  - Loader + mirrored TypeScript types for the new contract file (following the existing
    `web/lib/contract.ts` pattern).
- **Does NOT include:**
  - Any change to the anomaly algorithms, the model set, the existing `web/public/data/*`
    files, or the committed dataset (the new artifact is additive).
  - The forecast studio, gradient-boosting/LightGBM inference, lag/rolling feature
    engineering in JS, or `transform_numeric_features`/`align_to_encoded_columns` (SP2).
  - CSV upload of the visitor's own data (SP2).
  - ZKML / verifiable inference (SP3) and deployment (SP4).
  - Making location a model feature; it stays presentation-only context.

## Acceptance Criteria

- `anomaly_model_artifact_exported_and_validated`: running the exporter writes
  `web/public/data/anomaly_model.json`; it validates against its committed JSON Schema; a test
  asserts the sample conforms.
- `if_score_parity_within_tolerance`: for a fixed input set, the TypeScript `score_samples`
  matches the Python `isolation_forest_anomalies` reference within an absolute tolerance of
  1e-6 (asserted by a parity test; the tolerance is documented in the test).
- `zscore_verdict_matches_python`: for a fixed input set, the TypeScript z-score and its
  `|z| > 3` verdict match `zscore_anomalies` exactly.
- `predict_verdict_uses_exported_offset`: the Isolation Forest predict verdict is computed as
  `score < offset_` using the exported `offset_`, and matches the Python `predict` labels for
  the fixed input set.
- `checker_updates_live_with_no_network`: moving any slider updates the three read-outs with
  no network request after initial load (asserted by a no-network check over the interaction).
- `place_on_map_renders_with_standard_encoding`: clicking the map places the synthetic
  observation with the existing colour/shape encoding, and the context-only copy is present.
- `contract_swap_changes_zero_ts_logic`: regenerating `anomaly_model.json` from a fresh export
  changes no `.ts`/`.tsx` logic file (ADR-D preserved).
- `accessibility_and_reduced_motion_hold`: every slider and control is keyboard-reachable with
  a visible focus ring; `prefers-reduced-motion` disables any reveal/animation on the checker;
  the verdicts have a table or text equivalent.
- `build_and_checks_pass`: `cd web && npm run build` succeeds with zero console errors in light
  and dark themes, and `npm run check` (the SP0-wired redesign check) passes.

## Reproducibility

- Export: run the anomaly-model exporter (documented CLI, following the existing export
  pattern) to regenerate `web/public/data/anomaly_model.json` deterministically from the
  committed data (fixed `seed=42`, `contamination=0.02`, `n_estimators=200`).
- Parity: `pytest` generates/refreshes the golden reference vectors (committed as fixtures) and
  the front test suite (`cd web && npm test`) asserts JS-vs-Python parity within 1e-6.
- Front: `cd web && npm ci && npm run build && npm run check`, then `npx serve out` to
  exercise the checker; responsiveness checked 320px to 1536px.

## Risks and Assumptions

- Risk: exact reproduction of sklearn's `IsolationForest.score_samples` (path-length
  averaging, `_average_path_length` leaf correction, `c(n)` normalization). Mitigation: export
  the exact tree arrays and the `c(max_samples)` and `offset_` constants rather than recompute
  them; lock parity with a golden-vector test at 1e-6; if a specific internal resists exact
  reproduction, export the additional precomputed quantity instead of recomputing it in JS.
- Assumption: a browser-side Isolation Forest of 200 trees stays small and fast enough as a
  JSON artifact and at interaction time. Mitigation: the trees are shallow (max_samples-bounded)
  and the artifact is loaded once; if size is a concern, prune node fields to the minimum the
  scorer reads.
- Assumption: the five weather features have sensible interactive slider ranges. Mitigation:
  derive each slider's domain from the committed data's observed min/max at export time and
  ship it in the artifact, so ranges track the data rather than being hardcoded.
- Risk: the "place on the map" interaction could imply location affects the verdict. Mitigation:
  explicit context-only copy and keeping location out of the feature vector.
- Assumption: the parity test can run in the front-end test environment against Python-generated
  fixtures committed to the repo, so CI needs no Python-in-JS bridge; the fixtures are
  regenerated by a Python step and checked in.

## Alternatives Considered

- **Run the Isolation Forest via an ONNX runtime in the browser.** Rejected: ONNX conversion of
  `IsolationForest` is not reliably supported, and it adds a multi-megabyte WASM runtime for a
  model the project can serialize and traverse directly with exact parity.
- **Keep the checker's Isolation Forest precomputed and only make z-score live.** Rejected: the
  visitor wants both methods to respond to their input; a half-live checker undersells the
  system and would not build the reusable tree-traversal core SP2 needs.
- **Call the existing FastAPI `/anomaly` endpoint from the browser.** Rejected: it requires a
  deployed, always-on Python backend, contradicting the owner's browser-side preference and the
  static-export architecture; the API remains as a documented serving artifact.
- **Batch-paste as the primary interaction.** Rejected: the owner chose the slider laboratory
  as the hero; batch paste is deferred and CSV upload is SP2.
- **Placing the synthetic point at a fixed/neutral location instead of click-to-locate.**
  Rejected: click-to-locate is more engaging and, with the context-only copy, is honest about
  location being non-predictive.
