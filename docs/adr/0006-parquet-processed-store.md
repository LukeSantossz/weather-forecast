# ADR 0006: Parquet for processed data

- Status: Accepted (2026-07-07).
- Source: README Engineering Decisions.

## Context

Processed data needs a storage format that carries type information, keeps files compact,
and enforces a schema.

## Decision

Store processed data as Parquet.

## Consequences

- Type safety, 3-5x compression, and schema enforcement via PyArrow.
- Alternative considered: CSV, rejected because it offers none of type safety, compression,
  or schema enforcement.
