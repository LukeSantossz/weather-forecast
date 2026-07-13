# SPEC: feat(web): verifiable-inference proof (ZKML) as a bounded spike

> **Status: DEFERRED (off-roadmap).** After the end-of-roadmap necessity-and-value review, the
> owner moved SP3 off the delivery track: it is not scheduled, carries no portfolio acceptance
> criteria, and is not implemented as part of this effort. It is retained here as a recorded
> future-exploration idea. The credible "trust the browser's numbers" story is already delivered
> for free by the Python-vs-JS golden-vector parity tests built in SP1 and SP2; this spike would
> add a research-grade bet with marginal payoff, so it waits. Revisit only as standalone
> curiosity, decoupled from the portfolio deliverable. Tracked as issue #60.

Differentiator sub-project (SP3), a deliberately bounded research spike layered on the live
client-side inference of SP1 and SP2. It answers the skeptic's question about browser-side
inference - "how do I trust the browser ran the real model?" - by shipping a zero-knowledge
proof that the committed model produced a specific output for a specific input, and letting the
visitor verify it in the browser. Because the technique is genuinely hard for this project's
model types and the tooling is post the assistant's training cutoff, this SPEC is written as a
spike with an explicit decision gate: it either ships a working, browser-verifiable proof of one
canonical inference, or, if that proves intractable within the bounded effort, ships a clear
explainer of what a proof would establish and why our model type resists it. Either outcome is
recorded honestly.

## Problem

SP1 and SP2 move real inference into the browser, which invites a fair objection for a portfolio
skim: a client-side computation could be faked, so how does a viewer know the numbers came from
the actual committed model rather than a lookup table? Verifiable inference answers exactly this:
a zero-knowledge proof certifies that an output is the genuine result of the committed model on a
declared input, and verification is cheap even though proving is expensive
(`llm-wiki/wiki/zkml.md`). The project has no such proof today, so the "this is a real system"
claim rests on trust rather than evidence.

## Design Decision

Prove one canonical, fixed inference offline and verify it in the browser. A zero-knowledge proof
is bound to a specific input, and proving is far too expensive to run live for a visitor's
arbitrary perturbation, so the honest MVP is: offline, generate a proof that the committed model
produced a specific output for a specific input; ship the proof, its verification key, and the
declared public input/output into the static site; and give the browser a "verify" affordance
that runs the (cheap) verifier and shows valid or invalid, with copy stating precisely what is
and is not proven.

The proof targets one real model output - the intended target is a genuine inference such as the
GradientBoosting one-step forecast on the committed baseline input or the Isolation Forest
anomaly score for a canonical observation, so the proof backs a computation the visitor can also
watch run live in SP1/SP2. Which target is actually provable is a spike finding, because tree
ensembles are ZK-hostile (their splits are non-arithmetic comparisons, the recurring bottleneck
noted in the wiki) and the tooling (EZKL: ONNX -> zk-SNARK circuit) is oriented to neural graphs.

Because EZKL and the current ZK toolchain are past the assistant's training cutoff, this SPEC
describes the approach only at the level of the pipeline (export to ONNX, compile the circuit,
generate keys, prove offline, verify in-browser via the tool's WebAssembly verifier); the
implementation plan pulls the exact API, CLI, and version from EZKL's official documentation and
does not guess it.

The spike runs under a decision gate. If, within the bounded effort, EZKL can prove the chosen
model type and the browser can verify it, that is the deliverable. If it cannot (proving
intractable, verifier unshippable under the static-export CSP, or proving times unreasonable even
offline), the deliverable becomes a documented finding plus an in-page explainer of ZKML, what a
proof would establish, and why this project's model type resists it. The gate outcome is recorded
in the SPEC and an ADR.

## Architecture Decisions

Promoted to numbered ADRs under `docs/adr/` at the Spec Gate:

- **ADR (verify-in-browser, prove-offline).** Verifiable inference is delivered by generating
  proofs offline and verifying them client-side; live in-browser proving of arbitrary input is out
  of scope as infeasible. Rationale: matches the prove-expensive / verify-cheap asymmetry and keeps
  the app a static export.
- **ADR (SP3 is a gated spike).** The deliverable is whichever gate outcome is reached - a working
  browser-verifiable proof of one canonical inference, or a documented-intractability explainer -
  and the outcome is recorded. Rationale: scope honesty about a research-grade, post-cutoff
  technique.

## Scope

- **Includes:**
  - A spike to establish EZKL feasibility for one canonical inference from SP1/SP2, using EZKL's
    documented ONNX -> circuit -> proof pipeline, run offline.
  - On the positive gate outcome: committed proof artifacts (proof, verification key, declared
    public input/output) under `web/public/data/` (e.g. a `proof/` subtree) with a schema; a
    self-hosted, CSP-safe browser verifier; and a "verify" affordance (in the reproducibility
    close or the relevant act) that verifies with no network call and shows valid/invalid plus
    honest copy.
  - On the negative gate outcome: a documented finding (in the SPEC/ADR) and an in-page explainer
    of ZKML, what a proof would establish, and why this model type resists it.
  - A negative test that tampering with the declared public output makes verification fail.
- **Does NOT include:**
  - Live in-browser proof generation, or proving the visitor's arbitrary perturbed input.
  - Any change to the models, the pipeline, or the existing data contract files.
  - Verifiable training or verifiable testing (only inference is in scope).
  - Deployment (SP4).
  - Inventing EZKL API surface; the plan sources it from official docs.

## Acceptance Criteria

- `gate_outcome_recorded`: the spike's decision-gate outcome (which inference was proven, or the
  intractability finding) is recorded in the SPEC and an ADR, and exactly one of the two terminal
  deliverables below is shipped.
- `proof_verifies_in_browser` (positive outcome): the browser verifies the committed proof for the
  canonical inference with no network request after load and no backend, and displays a valid
  result; the declared public input/output validates against its schema.
- `tampering_fails_verification` (positive outcome): altering the declared public output causes the
  browser verification to report invalid (a committed negative test).
- `explainer_shipped` (negative outcome): if the gate closes negative, an in-page ZKML explainer is
  shipped stating what a proof would establish and why this model type resists it, and no fake or
  non-verifying proof is presented as real.
- `honest_scope_copy`: the UI states precisely that the proof (if shipped) establishes that the
  committed model produced this output for this fixed input, and does not claim to prove the
  visitor's arbitrary inputs.
- `self_contained_and_csp_safe`: any verifier WebAssembly and all artifacts are self-hosted with no
  external request, and the page passes its existing checks under the static-export CSP.
- `build_and_checks_pass`: `cd web && npm run build` succeeds with zero console errors in light and
  dark themes, `npm test` passes, and `npm run check` passes.

## Reproducibility

- Offline proving: a documented script (pinned EZKL version) regenerates the proof and keys from the
  committed model and the canonical input; the exact commands come from EZKL's official docs and are
  recorded in the script.
- Verification: `cd web && npm ci && npm run build`, then `npx serve out` and use the verify
  affordance; verification runs entirely client-side.
- The spike's feasibility notes (proving time, artifact sizes, circuit constraints) are recorded
  alongside the gate outcome.

## Risks and Assumptions

- Risk: tree ensembles are ZK-hostile (non-arithmetic split comparisons), so the intended target may
  not be provable in reasonable time. Mitigation: the decision gate and explainer fallback; the spike
  may retarget to the most tractable real inference before falling back.
- Risk: EZKL and the ZK toolchain are post the training cutoff. Mitigation: the plan pulls exact API
  and versions from official docs and pins them; the SPEC does not encode guessed API.
- Risk: the verifier WebAssembly may be large or hard to ship CSP-safe in a static export.
  Mitigation: `self_contained_and_csp_safe` is an acceptance criterion; if it cannot be met, that is
  a negative gate outcome, not a hack around the CSP.
- Assumption: offline proving time is bounded enough to be a build/one-time step, not a live one.
  Mitigation: proving is never on the request path; only verification is.
- Assumption: proving one fixed inference is a meaningful demonstration even without input
  interactivity. It backs a computation the visitor also watches run live in SP1/SP2, which is the
  point of siting SP3 after them.

## Alternatives Considered

- **Live in-browser proving of the visitor's input.** Rejected: proving is far too expensive to run
  live, and proofs are per-input, so arbitrary perturbations cannot be pre-proven.
- **Attest via a Trusted Execution Environment instead of a ZK proof.** Rejected: TEE attestation
  proves the execution environment, not each step of the computation, and is weaker and not
  static-site friendly (`llm-wiki/wiki/zkml.md`, Tab. III).
- **Skip SP3 entirely.** Held open deliberately: this is a high-risk differentiator, and the
  end-of-roadmap necessity-and-value review may recommend cutting or deferring it; the gated-spike
  framing makes that a clean decision.
- **Prove a trivial arithmetic step (e.g. the z-score) to guarantee a green result.** Rejected as the
  default: proving a subtraction and division demonstrates little; the spike aims at a real model
  output and is honest if it must fall back.
