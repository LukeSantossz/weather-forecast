# SPEC: feat(nlp): semantic search over anomaly records (core + precomputed embeddings)

## Problem
Detected weather anomalies are only browsable as a static table; there is no way to ask "extreme heat events in coastal Asia" in natural language. Issue #32 asks for retrieval over the anomaly records by meaning, keyless and offline. This SPEC delivers the tested core (a `src` search module) and ships precomputed embeddings to the dashboard data contract; the in-browser search UI is a follow-up slice.

## Design Decision
Add `weather_forecast/semantic_search.py` built on `sentence-transformers` (`all-MiniLM-L6-v2`, 384-dim, normalized embeddings), with an in-memory cosine-similarity index (no external service, no API key). The scoring core is split so the ranking logic is testable without the model:

- `render_record(record)` renders an anomaly record (`country`, `ts`, `temp_c`, `z`, `detected_by`, ...) to a searchable sentence.
- `cosine_top_k(query_vec, doc_matrix, k)` is pure NumPy over normalized vectors and is unit-tested without any model.
- `embed_texts(texts, *, model_name)` and `SemanticIndex.from_records(records, ...)` / `SemanticIndex.search(query, top_k)` use the model (imported lazily).
- `build_embedding_payload(records, *, model_name)` returns `{model, dim, generated_at, records: [{...record, embedding: [...]}]}`; a CLI writes it to `web/public/data/anomaly_embeddings.json` (validated by a new JSON schema) so the static dashboard can ship precomputed record embeddings.
- `python -m weather_forecast.semantic_search --query "..."` prints the top matches; `--build-embeddings <out>` precomputes the payload.

The heavy stack (`sentence-transformers`, which pulls `torch`) lives in a new `nlp` optional-dependency extra, imported lazily so importing the module never requires it. Per the chosen design, it is exercised in CI: a dedicated `nlp-test` job (single Python) installs `.[dev,nlp]` and runs the model-backed tests with a cached Hugging Face hub, while the main test matrix runs the model-free tests (the model-backed ones `importorskip`).

## Alternatives Considered
- **Lightweight TF-IDF (no torch).** Rejected for this project: the user chose real sentence-transformer embeddings for a faithful RAG showcase; TF-IDF is lexical, not semantic.
- **Torch in the whole CI matrix.** Rejected: a dedicated single-Python `nlp-test` job tests the real model in CI without doubling `torch` installs across the 3.10/3.11 matrix.
- **A hosted vector DB (FAISS/pgvector).** Rejected: 150 records fit an in-memory NumPy cosine search; no service to run keeps it keyless/offline.
- **Runtime embedding in the FastAPI service.** Deferred: this slice ships the data contract; a browser-side (transformers.js) or API search is a follow-up.

## Scope
- Includes:
  - `weather_forecast/semantic_search.py`: `render_record`, `cosine_top_k`, `embed_texts`, `SemanticIndex` (`from_records`, `search`), `build_embedding_payload`, and a `__main__` CLI (`--query`, `--build-embeddings`, `--top-k`, `--model`).
  - `nlp` extra (`sentence-transformers`); a `nlp-test` CI job with a Hugging Face cache; the main matrix keeps model-backed tests via `importorskip`.
  - Precomputed `web/public/data/anomaly_embeddings.json` and its JSON schema `web/public/data/schema/anomaly_embeddings.schema.json`.
  - Tests: `cosine_top_k` ranking (model-free), `render_record` content (model-free), and model-backed index search + payload shape (`importorskip`).
  - README "Semantic search" subsection.
- Does NOT include:
  - The browser search component (in-browser query embedding + results UI) — a follow-up slice within #32.
  - Re-detecting anomalies or changing `anomalies.json`; embeddings are computed from the existing records.
  - Summarizing matches with an LLM.

## Acceptance Criteria
- `cosine_top_k_ranks_by_similarity`: given a query vector and a matrix, returns the indices ordered by descending cosine similarity, honoring `k` (model-free).
- `render_record_includes_key_fields`: the rendered text contains the country, temperature, and detection method (model-free).
- `index_search_ranks_relevant_record`: on a small fixture, a natural-language query ranks the semantically matching record first (model-backed, `importorskip`).
- `build_payload_has_embeddings`: `build_embedding_payload` returns one embedding per record of length `dim` with the model name recorded (model-backed).
- `anomaly_embeddings.json` validates against its schema; the committed file has one embedding per anomaly record.
- Existing suite passes; `ruff`/`mypy` clean; README documents usage and that the core is keyless/offline.

## Reproducibility
`pip install -e .[dev,nlp]` then `pytest tests/test_semantic_search.py -q`. Model-free tests run everywhere; model-backed tests download `all-MiniLM-L6-v2` once (cached) and are deterministic given fixed inputs. Rebuild the shipped embeddings with `python -m weather_forecast.semantic_search --build-embeddings web/public/data/anomaly_embeddings.json`. Python 3.10/3.11.

## Risks and Assumptions
- Assumption: `all-MiniLM-L6-v2` is reachable from the Hugging Face hub in CI; the `nlp-test` job caches it, and a download outage would fail only that job (the main matrix is unaffected).
- Assumption: absolute cosine scores are low but the ranking is meaningful (validated: a Middle-East heat query ranks the Kuwait record first); search quality is about order, not score magnitude.
- Medium risk: `torch` is a heavy dependency. Mitigated by the `nlp` extra, lazy imports, and a single dedicated CI job.
- Low risk: the module is additive; nothing else imports it.
