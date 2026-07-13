# ADR 0011: Browser inference by exported artifact

- Status: Accepted (2026-07-13).
- Source: SPEC 0033 (Architecture Decisions), promoted at the Spec Gate.

## Context

The dashboard is a static export with no backend, yet the interactive roadmap needs the
visitor to run the project's own models live in the browser (starting with the anomaly
checker, SP1). Something has to own the fitted model and something has to run inference, and
those two responsibilities can sit on either side of the network.

## Decision

Do client-side inference by exporting the fitted models from Python into a versioned contract
artifact (`web/public/data/anomaly_model.json`, with a JSON Schema and conformance test) and
running a pure-TypeScript engine over it. The browser never trains and never calls a backend;
it loads the artifact and computes. This preserves ADR-D (Python owns the contract): swapping
the data and re-exporting changes no `.ts`/`.tsx` logic.

## Consequences

- Keeps the app a static export and keeps training authority in Python, while giving a
  genuine, inspectable client-side computation. Parity with the Python reference is locked by
  golden-vector tests at 1e-6.
- Alternatives considered: an ONNX runtime in the browser, rejected because `IsolationForest`
  ONNX conversion is not reliably supported and it adds a multi-megabyte WASM runtime for a
  model the project can serialize and traverse directly; calling the existing FastAPI
  `/anomaly` endpoint, rejected because it requires an always-on Python backend, contradicting
  the static-export architecture (the API remains as a documented serving artifact).
