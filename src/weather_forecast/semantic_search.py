"""Semantic search over anomaly records (issue #32).

Embeds a text rendering of each detected-anomaly record with a
sentence-transformers model (``all-MiniLM-L6-v2``, 384-dim, normalized) and
answers free-text queries by cosine similarity over an in-memory index. No
external service and no API key: the model runs locally.

The ranking core (``cosine_top_k``) and ``render_record`` are model-free so the
retrieval logic is testable without the model. ``sentence-transformers`` (and
its ``torch`` dependency) is imported lazily and lives in the ``nlp`` extra.

CLI: ``python -m weather_forecast.semantic_search --query "extreme heat in asia"``
searches; ``--build-embeddings <out.json>`` precomputes the embeddings payload
shipped to the dashboard.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

DEFAULT_MODEL = "all-MiniLM-L6-v2"

# Curated example queries whose embeddings are precomputed and shipped so the
# static dashboard can offer a keyless search demo without an in-browser model.
EXAMPLE_QUERIES = (
    "extreme heat events",
    "scorching desert temperatures",
    "unusually cold weather",
    "freezing winter conditions",
    "the strongest temperature anomalies",
    "unusual warmth in the Middle East",
)

_SCHEMA_VERSION = "1.0"
_models: dict[str, Any] = {}


def _temperature_phrase(temp: Any, z: Any) -> str:
    """A qualitative phrase (magnitude + anomaly strength) for embedding signal.

    Templated numeric text gives the model weak hot/cold signal, so we add
    descriptive language keyed to the temperature magnitude and |z| so queries
    like "record high temperatures" or "very cold" retrieve the right records.
    """
    if isinstance(temp, (int, float)):
        if temp >= 38:
            magnitude = "scorching, extreme heat"
        elif temp >= 30:
            magnitude = "very hot"
        elif temp >= 22:
            magnitude = "warm"
        elif temp <= -12:
            magnitude = "freezing, extreme cold"
        elif temp <= 0:
            magnitude = "very cold"
        elif temp <= 10:
            magnitude = "cold"
        else:
            magnitude = "mild"
    else:
        magnitude = "anomalous"

    if isinstance(z, (int, float)) and abs(z) >= 3:
        strength = "a severe"
    elif isinstance(z, (int, float)) and abs(z) >= 2:
        strength = "a notable"
    else:
        strength = "an"
    return f"{strength} {magnitude} temperature anomaly"


def render_record(record: dict) -> str:
    """Render an anomaly record to a searchable sentence.

    Includes a qualitative descriptor (heat/cold magnitude and anomaly strength)
    so free-text queries about heat or cold have semantic signal beyond the raw
    temperature number.
    """
    date = str(record.get("ts", ""))[:10]
    phrase = _temperature_phrase(record.get("temp_c"), record.get("z"))
    return (
        f"On {date}, {record.get('country')} experienced {phrase}: "
        f"temperature {record.get('temp_c')}C, z-score {record.get('z')}, "
        f"detected by {record.get('detected_by')}."
    )


def cosine_top_k(query_vec: Any, doc_matrix: Any, k: int) -> list[tuple[int, float]]:
    """Return the ``k`` highest cosine-similarity ``(index, score)`` pairs.

    Inputs need not be pre-normalized; vectors are normalized here.
    """
    query = np.asarray(query_vec, dtype=float)
    docs = np.asarray(doc_matrix, dtype=float)
    query_norm = query / (np.linalg.norm(query) or 1.0)
    doc_norms = docs / np.clip(np.linalg.norm(docs, axis=1, keepdims=True), 1e-12, None)
    sims = doc_norms @ query_norm
    k = min(k, len(sims))
    order = np.argsort(-sims)[:k]
    return [(int(i), float(sims[i])) for i in order]


def _get_model(model_name: str) -> Any:
    if model_name not in _models:
        from sentence_transformers import SentenceTransformer

        _models[model_name] = SentenceTransformer(model_name)
    return _models[model_name]


def embed_texts(texts: list[str], *, model_name: str = DEFAULT_MODEL) -> np.ndarray:
    """Embed texts to normalized float32 vectors with the given model."""
    model = _get_model(model_name)
    return np.asarray(model.encode(list(texts), normalize_embeddings=True), dtype=np.float32)


@dataclass
class SemanticIndex:
    """An in-memory cosine-similarity index over embedded anomaly records."""

    records: list[dict]
    embeddings: np.ndarray
    model_name: str

    @classmethod
    def from_records(cls, records: list[dict], *, model_name: str = DEFAULT_MODEL) -> SemanticIndex:
        texts = [render_record(r) for r in records]
        embeddings = embed_texts(texts, model_name=model_name)
        return cls(records=list(records), embeddings=embeddings, model_name=model_name)

    def search(self, query: str, *, top_k: int = 5) -> list[dict]:
        """Return the ``top_k`` records most similar to ``query``, with scores."""
        query_vec = embed_texts([query], model_name=self.model_name)[0]
        hits = cosine_top_k(query_vec, self.embeddings, top_k)
        return [{**self.records[i], "score": round(score, 6)} for i, score in hits]


def _round_vector(vector: Any) -> list[float]:
    return [round(float(x), 6) for x in vector]


def build_embedding_payload(records: list[dict], *, model_name: str = DEFAULT_MODEL) -> dict:
    """Build a JSON-serializable payload of records and example-query embeddings."""
    embeddings = embed_texts([render_record(r) for r in records], model_name=model_name)
    query_embeddings = embed_texts(list(EXAMPLE_QUERIES), model_name=model_name)
    return {
        "schema_version": _SCHEMA_VERSION,
        "model": model_name,
        "dim": int(embeddings.shape[1]),
        "records": [
            {**record, "embedding": _round_vector(embeddings[i])}
            for i, record in enumerate(records)
        ],
        "queries": [
            {"text": text, "embedding": _round_vector(query_embeddings[i])}
            for i, text in enumerate(EXAMPLE_QUERIES)
        ],
    }


def _load_anomaly_records(project_root: Path) -> list[dict]:
    path = project_root / "web" / "public" / "data" / "anomalies.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return list(data["records"])


def main(argv: list[str] | None = None) -> int:
    """CLI: search the anomaly records or precompute their embeddings."""
    parser = argparse.ArgumentParser(
        prog="weather_forecast.semantic_search",
        description="Semantic search over detected anomaly records.",
    )
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--query", type=str, default=None, help="Natural-language query.")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL)
    parser.add_argument(
        "--build-embeddings",
        type=Path,
        default=None,
        help="Write the precomputed embeddings payload to this path and exit.",
    )
    args = parser.parse_args(argv)

    records = _load_anomaly_records(args.project_root)

    if args.build_embeddings is not None:
        payload = build_embedding_payload(records, model_name=args.model)
        args.build_embeddings.parent.mkdir(parents=True, exist_ok=True)
        args.build_embeddings.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {len(payload['records'])} embeddings to {args.build_embeddings}")
        return 0

    if args.query is None:
        parser.error("provide --query or --build-embeddings")

    index = SemanticIndex.from_records(records, model_name=args.model)
    for hit in index.search(args.query, top_k=args.top_k):
        print(f"{hit['score']:.3f}  {render_record(hit)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
