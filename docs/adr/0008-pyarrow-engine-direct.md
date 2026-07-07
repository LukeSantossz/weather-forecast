# ADR 0008: PyArrow engine directly

- Status: Accepted (2026-07-07).
- Source: README Engineering Decisions.

## Context

Writing Parquet through the pandas PyArrow backend triggers a known Jupyter kernel crash.

## Decision

Use the PyArrow engine directly.

## Consequences

- Avoids the known Jupyter kernel crash with the pandas PyArrow backend.
- Alternative considered: the pandas `to_parquet` wrapper, rejected because it triggers the
  kernel crash.
