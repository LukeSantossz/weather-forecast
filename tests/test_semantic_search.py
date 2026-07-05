"""Unit tests for weather_forecast.semantic_search (issue #32).

The ranking core (`cosine_top_k`) and `render_record` are model-free and run
everywhere. The model-backed tests (`SemanticIndex`, `build_embedding_payload`)
are skipped unless sentence-transformers is installed (the ``nlp`` extra).
"""

import json
from pathlib import Path

import numpy as np
import pytest
from jsonschema import validate

from weather_forecast.semantic_search import (
    build_embedding_payload,
    cosine_top_k,
    render_record,
)

_REPO_ROOT = Path(__file__).resolve().parent.parent

_FIXTURE = [
    {
        "country": "Kuwait",
        "ts": "2024-07-01T00:00:00Z",
        "temp_c": 52.3,
        "z": 4.1,
        "detected_by": "zscore",
    },
    {
        "country": "Norway",
        "ts": "2024-01-15T00:00:00Z",
        "temp_c": -30.2,
        "z": -3.8,
        "detected_by": "zscore",
    },
]


def test_cosine_top_k_ranks_by_similarity() -> None:
    docs = np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.9, 0.1, 0.0]])
    query = np.array([1.0, 0.0, 0.0])
    result = cosine_top_k(query, docs, k=2)
    assert len(result) == 2
    indices = [i for i, _ in result]
    assert indices[0] == 0  # exact match ranks first
    assert indices[1] == 2  # near match ranks above the orthogonal vector
    assert result[0][1] >= result[1][1]  # scores descending


def test_render_record_includes_key_fields() -> None:
    text = render_record(_FIXTURE[0])
    assert "Kuwait" in text
    assert "52.3" in text
    assert "zscore" in text


def test_index_search_ranks_relevant_record() -> None:
    pytest.importorskip("sentence_transformers")
    from weather_forecast.semantic_search import SemanticIndex

    index = SemanticIndex.from_records(_FIXTURE)
    hits = index.search("extreme heat wave", top_k=2)
    assert hits[0]["country"] == "Kuwait"
    assert "score" in hits[0]


def test_build_payload_has_embeddings() -> None:
    pytest.importorskip("sentence_transformers")
    payload = build_embedding_payload(_FIXTURE)
    assert payload["dim"] == 384
    assert payload["model"] == "all-MiniLM-L6-v2"
    assert len(payload["records"]) == len(_FIXTURE)
    assert len(payload["records"][0]["embedding"]) == 384


def test_shipped_embeddings_validate_against_schema() -> None:
    data_dir = _REPO_ROOT / "web" / "public" / "data"
    payload = json.loads((data_dir / "anomaly_embeddings.json").read_text(encoding="utf-8"))
    schema = json.loads(
        (data_dir / "schema" / "anomaly_embeddings.schema.json").read_text(encoding="utf-8")
    )
    validate(instance=payload, schema=schema)
    assert all(len(r["embedding"]) == payload["dim"] for r in payload["records"])
