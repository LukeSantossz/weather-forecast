# SPEC: feat(web): dashboard preset-query semantic search over anomalies

## Problem
Issue #32's core (SPEC 0027) ships precomputed anomaly embeddings to the dashboard data dir but nothing uses them yet. This SPEC adds the browser-side search demo: a keyless, offline experience that ranks anomaly records by semantic similarity to a query, with no in-browser ML model.

## Design Decision
Precompute the embeddings of a small curated set of example queries at build time (same `all-MiniLM-L6-v2` model) and ship them alongside the record embeddings in `anomaly_embeddings.json` under a new `queries` field. In the browser, selecting an example query computes cosine similarity as a plain dot product (both record and query vectors are already L2-normalized) and shows the top matches. No transformers.js, no WASM, no model weights, no network beyond the static JSON, which keeps the static export and its build deterministic and verifiable.

- Python: add `EXAMPLE_QUERIES` and extend `build_embedding_payload` to embed them into `payload["queries"] = [{text, embedding}]`; update the JSON schema and regenerate the shipped file.
- Web: add `AnomalyEmbeddings` types and a `loadAnomalyEmbeddings()` loader to `lib/contract.ts`; add a `SemanticSearch` component (Astryx primitives) that renders the example-query chips and a ranked result list; wire it into `AnomaliesSection`.

## Alternatives Considered
- **Free-text query embedding via transformers.js.** Deferred: authentic but adds a large WASM/model dependency and unverifiable-here browser inference; the preset-query demo is robust, keyless, and fully build-verifiable, per the maintainer's choice.
- **Compute similarity in a Web Worker.** Rejected: 150 x 384 dot products are trivial on the main thread.
- **A separate embeddings file for queries.** Rejected: co-locating queries with records in one contract keeps a single fetch and one schema.

## Scope
- Includes:
  - Python: `EXAMPLE_QUERIES`; `build_embedding_payload` emits a `queries` field; schema `anomaly_embeddings.schema.json` gains `queries`; regenerated `web/public/data/anomaly_embeddings.json`; updated Python tests.
  - Web: `lib/contract.ts` types + `loadAnomalyEmbeddings`; `components/anomalies/SemanticSearch.tsx`; wiring in `AnomaliesSection.tsx`; styles in `anomalies.css`.
  - README note that the dashboard has a semantic-search demo.
- Does NOT include:
  - Free-text query input (deferred transformers.js follow-up).
  - Changing the anomaly records, the map, or other sections.
  - A JS unit-test harness (the web app has none; verification is `next build` + `tsc`, matching existing dashboard work).

## Acceptance Criteria
- `build_payload_includes_example_queries`: `build_embedding_payload` returns a non-empty `queries` list, each with `text` and an embedding of length `dim`.
- The regenerated `anomaly_embeddings.json` validates against the updated schema (existing schema test), and contains both `records` and `queries` embeddings.
- `next build` compiles and static-exports with no TypeScript errors; `SemanticSearch` renders example-query chips and, on selection, a ranked list of records with scores.
- Cosine ranking in the browser matches the Python core's ordering for the same query/vectors (dot product of normalized vectors).
- Python suite passes; `ruff`/`mypy` clean.

## Reproducibility
Backend: `pytest tests/test_semantic_search.py -q`; regenerate with `python -m weather_forecast.semantic_search --build-embeddings web/public/data/anomaly_embeddings.json`. Web: `cd web && npm run build`. The dashboard search is deterministic given the shipped embeddings.

## Risks and Assumptions
- Assumption: query and record embeddings are L2-normalized (they are; `encode(normalize_embeddings=True)`), so a dot product is cosine similarity.
- Low risk: additive component and one new data field; other sections are untouched. The main verification gap (no JS unit tests) is mitigated by `next build`/`tsc` and by keeping the similarity logic a trivial dot product mirrored from the tested Python `cosine_top_k`.
