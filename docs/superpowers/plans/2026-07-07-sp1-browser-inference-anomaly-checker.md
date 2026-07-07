# SP1 Browser Inference Core and Live Anomaly Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only Anomalies act into a live, browser-side anomaly checker: five sliders drive both anomaly methods (z-score and Isolation Forest) computed entirely in the browser with no backend, and a click-to-place point drops the imagined observation on the existing map.

**Architecture:** Python (which owns the model, ADR-D) fits the anomaly models on the committed data and exports everything the browser needs into a new additive contract artifact `web/public/data/anomaly_model.json`. A new pure-TypeScript inference core (a tree-traversal primitive, an exact reproduction of sklearn's IsolationForest `score_samples`, StandardScaler feature parity, and z-score) runs in the browser, validated against Python-generated golden fixtures. A new anomaly-checker panel and a click-to-locate map interaction present it.

**Tech Stack:** Python 3.10/3.11 + scikit-learn + pytest (exporter, golden fixtures); Next.js static export under `web/` + TypeScript; the FIRST web test runner (vitest) is introduced here; MapLibre GL (existing).

## Global Constraints

- Python owns the model; the browser never trains. Regenerating `anomaly_model.json` from a fresh export must change zero `.ts`/`.tsx` logic (ADR-D). (spec 0033)
- The new artifact is ADDITIVE: no existing `web/public/data/*` file is modified. (spec 0033 Scope)
- IsolationForest fit is deterministic: `seed=42`, `contamination=0.02`, `n_estimators=200`, features in this exact order: `temperature_celsius, humidity, wind_kph, pressure_mb, precip_mm`. (src/weather_forecast/anomaly.py)
- Parity tolerance: JS `score_samples` matches Python within absolute 1e-6; z-score and predict verdicts match exactly. (spec 0033 Acceptance Criteria)
- No network request after initial load in the checker. (spec 0033)
- All output English; no em-dashes (ASCII hyphens only); Conventional Commits; TDD red-green-refactor. (.standards)
- Location is presentation-only context; it is never a model feature. (spec 0033)
- Accessibility: every control keyboard-reachable with a visible focus ring; `prefers-reduced-motion` disables checker animation; the verdicts have a table/text equivalent. (spec 0033)
- Follow existing patterns (documented per task): the `anomaly_embeddings.json` standalone-artifact path, `loadAnomalyEmbeddings`, the `SemanticSearch` component shape, and the `sem-highlights` map source/layer pattern.

---

### Task 1: Python exporter, schema, and the committed `anomaly_model.json`

**Files:**
- Modify: `src/weather_forecast/anomaly.py` (add a serialization builder that returns the export dict)
- Create: `web/public/data/schema/anomaly_model.schema.json`
- Create: `web/public/data/anomaly_model.json` (generated, committed)
- Test: `tests/test_anomaly.py` (add tests for the builder + a committed-artifact conformance test)

**Interfaces:**
- Produces `build_anomaly_model(df: pd.DataFrame, *, generated_at: str, seed: int = 42, contamination: float = 0.02, n_estimators: int = 200) -> dict`. The dict schema (all fields required, `additionalProperties: false`):
  - `schema_version: "1.0"`, `generated_at: str`, `data_status: "real"`
  - `features: string[]` (the 5 names, in order)
  - `scaler: { mean: number[5], scale: number[5] }` (StandardScaler `mean_`, `scale_`)
  - `medians: number[5]` (the median fill values, in feature order)
  - `feature_ranges: { min: number[5], max: number[5] }` (observed min/max per feature, for slider domains)
  - `zscore: { mu: number, sigma: number, threshold: 3.0 }` (temperature-series population baseline)
  - `isolation_forest: { max_samples: number, offset: number, trees: Tree[] }` where `Tree = { feature: number[], threshold: number[], children_left: number[], children_right: number[], n_node_samples: number[] }` (per-node arrays from each `estimator.tree_`; leaf nodes have `feature = -2`).

- [ ] **Step 1: Write the failing builder test**

Add to `tests/test_anomaly.py`:

```python
def test_build_anomaly_model_shape_and_determinism():
    from weather_forecast.anomaly import build_anomaly_model, DEFAULT_IF_FEATURES

    rng = np.random.default_rng(0)
    n = 300
    df = pd.DataFrame({
        "temperature_celsius": rng.normal(15, 8, n),
        "humidity": rng.uniform(10, 100, n),
        "wind_kph": rng.uniform(0, 60, n),
        "pressure_mb": rng.normal(1013, 12, n),
        "precip_mm": rng.exponential(1.0, n),
    })

    m = build_anomaly_model(df, generated_at="2026-07-05T00:00:00Z")

    assert m["data_status"] == "real"
    assert m["features"] == list(DEFAULT_IF_FEATURES)
    assert len(m["scaler"]["mean"]) == 5 and len(m["scaler"]["scale"]) == 5
    assert len(m["medians"]) == 5
    assert len(m["isolation_forest"]["trees"]) == 200
    # determinism: same seed -> identical export
    m2 = build_anomaly_model(df, generated_at="2026-07-05T00:00:00Z")
    assert m == m2
    # each tree exposes the five parallel node arrays of equal length
    t = m["isolation_forest"]["trees"][0]
    L = len(t["feature"])
    assert all(len(t[k]) == L for k in ("threshold", "children_left", "children_right", "n_node_samples"))
```

- [ ] **Step 2: Run it to see it fail**

Run: `PYTHONPATH=src python -m pytest tests/test_anomaly.py::test_build_anomaly_model_shape_and_determinism -v`
Expected: FAIL with `ImportError: cannot import name 'build_anomaly_model'`.

- [ ] **Step 3: Implement `build_anomaly_model` in `anomaly.py`**

Add (reuse the module's existing `DEFAULT_IF_FEATURES`, `IsolationForest`, `StandardScaler` imports; the fit must mirror `isolation_forest_anomalies` exactly - median fill, then StandardScaler, then IsolationForest with the same params):

```python
def build_anomaly_model(
    df: pd.DataFrame,
    *,
    generated_at: str,
    seed: int = 42,
    contamination: float = 0.02,
    n_estimators: int = 200,
) -> dict[str, Any]:
    """Fit the anomaly models and serialize everything the browser needs to infer.

    Mirrors ``isolation_forest_anomalies`` (median fill, StandardScaler, IsolationForest)
    and ``zscore_anomalies`` (population mu/sigma on temperature) so the exported model
    reproduces both methods client-side.
    """
    feats = list(DEFAULT_IF_FEATURES)
    X = df[feats].astype(float)
    medians = X.median()
    filled = X.fillna(medians)
    scaler = StandardScaler().fit(filled)
    scaled = scaler.transform(filled)
    iso = IsolationForest(
        n_estimators=n_estimators, contamination=contamination, random_state=seed, n_jobs=-1
    ).fit(scaled)

    def _tree(est) -> dict[str, list]:
        t = est.tree_
        return {
            "feature": t.feature.tolist(),
            "threshold": t.threshold.tolist(),
            "children_left": t.children_left.tolist(),
            "children_right": t.children_right.tolist(),
            "n_node_samples": t.n_node_samples.tolist(),
        }

    temp = df["temperature_celsius"].astype(float)
    mu = float(temp.mean())
    sigma = max(float(temp.std(ddof=0)), 1e-9)

    return {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "data_status": "real",
        "features": feats,
        "scaler": {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
        "medians": medians.tolist(),
        "feature_ranges": {"min": filled.min().tolist(), "max": filled.max().tolist()},
        "zscore": {"mu": mu, "sigma": sigma, "threshold": 3.0},
        "isolation_forest": {
            "max_samples": int(iso.max_samples_),
            "offset": float(iso.offset_),
            "trees": [_tree(e) for e in iso.estimators_],
        },
    }
```

- [ ] **Step 4: Run the test to green**

Run: `PYTHONPATH=src python -m pytest tests/test_anomaly.py::test_build_anomaly_model_shape_and_determinism -v`
Expected: PASS.

- [ ] **Step 5: Write the JSON Schema**

Create `web/public/data/schema/anomaly_model.schema.json` following `metrics.schema.json`'s conventions (draft 2020-12, `$id`, `required` listing every field, `additionalProperties: false` at every object level). Model the arrays as `{"type": "array", "items": {"type": "number"}}`, `features.items` as `{"type": "string"}`, and each tree as an object with the five required numeric arrays. Set `zscore.threshold` const to `3.0` is not required; type number is enough.

- [ ] **Step 6: Generate the committed artifact**

Write a short generation snippet (run once) that loads the committed data via `daily`-independent raw load and writes the file. Run from the repo root with the project's Python:

```python
# scripts/_gen_anomaly_model.py (temporary generation helper; keep it, it documents provenance)
from pathlib import Path
import json, subprocess
from weather_forecast.data_loader import load_raw_weather
from weather_forecast.anomaly import build_anomaly_model

root = Path.cwd()
sha = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip()
df = load_raw_weather(root)
model = build_anomaly_model(df, generated_at="2026-07-05T00:00:00Z")
model["pipeline"] = {"source": "anomaly.build_anomaly_model", "repo_commit": sha}
Path("web/public/data/anomaly_model.json").write_text(json.dumps(model, indent=2) + "\n")
print("wrote web/public/data/anomaly_model.json")
```

(Add `pipeline` to the schema's properties + required if you keep it, mirroring `meta.json`'s `pipeline` block.) Run: `PYTHONPATH=src python scripts/_gen_anomaly_model.py`.

- [ ] **Step 7: Write the committed-artifact conformance test**

Add to `tests/test_anomaly.py` (mirror `tests/test_semantic_search.py::test_shipped_embeddings_validate_against_schema`):

```python
def test_shipped_anomaly_model_validates_against_schema():
    import json
    from pathlib import Path
    import jsonschema

    root = Path(__file__).resolve().parents[1]
    payload = json.loads((root / "web/public/data/anomaly_model.json").read_text())
    schema = json.loads((root / "web/public/data/schema/anomaly_model.schema.json").read_text())
    jsonschema.validate(instance=payload, schema=schema)
    assert payload["data_status"] == "real"
    assert len(payload["isolation_forest"]["trees"]) == 200
```

- [ ] **Step 8: Run the anomaly test module green**

Run: `PYTHONPATH=src python -m pytest tests/test_anomaly.py -v`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/weather_forecast/anomaly.py web/public/data/anomaly_model.json web/public/data/schema/anomaly_model.schema.json scripts/_gen_anomaly_model.py tests/test_anomaly.py
git commit -m "feat(anomaly): export the fitted anomaly model to the web contract"
```

---

### Task 2: Allow additive artifacts in the redesign data-contract check

**Files:**
- Modify: `web/scripts/check-redesign.mjs` (the data-contract assertion)

**Interfaces:** none. Adjusts a guard so adding `anomaly_model.json` does not falsely fail.

- [ ] **Step 1: Understand the current failure**

The check runs `git diff --name-only <base> -- web/public/data` and fails on ANY change. Task 1 ADDED `anomaly_model.json` + its schema, so the check now fails on a legitimate additive artifact. The guard should catch only MODIFICATIONS or DELETIONS to existing files, not additions.

- [ ] **Step 2: Restrict the diff to modified/deleted files**

In `web/scripts/check-redesign.mjs`, change the diff command from `git diff --name-only ${baseRef} -- web/public/data` to `git diff --name-only --diff-filter=MD ${baseRef} -- web/public/data`, and update the surrounding comment to state that additive artifacts are allowed while existing contract files must stay byte-identical.

- [ ] **Step 3: Verify locally**

Run: `npm --prefix web run build && npm --prefix web run check`
Expected: `redesign check passed` (the new `anomaly_model.json` no longer trips it; modifying an existing file still would).

- [ ] **Step 4: Commit**

```bash
git add web/scripts/check-redesign.mjs
git commit -m "chore(web): let the redesign check allow additive data artifacts"
```

---

### Task 3: Introduce the web test runner (vitest)

**Files:**
- Modify: `web/package.json` (add `vitest` devDependency + a `test` script)
- Create: `web/vitest.config.ts`
- Create: `web/lib/inference/__tests__/smoke.test.ts` (a trivial passing test proving the runner works)
- Modify: `.github/workflows/web-ci.yml` (run `npm test` after the build)

- [ ] **Step 1: Add vitest and the test script**

In `web/package.json`, add `"vitest": "^3"` to `devDependencies` and `"test": "vitest run"` to `scripts` (after `check`). Run `npm --prefix web install` to update the lockfile.

- [ ] **Step 2: Add the config**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add a smoke test**

Create `web/lib/inference/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run the runner green**

Run: `npm --prefix web test`
Expected: 1 passed.

- [ ] **Step 5: Wire into CI**

In `.github/workflows/web-ci.yml`, after the `Redesign acceptance checks` step add:

```yaml
      - name: Unit tests
        run: npm test
```

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/lib/inference/__tests__/smoke.test.ts .github/workflows/web-ci.yml
git commit -m "test(web): add the vitest runner and wire it into CI"
```

---

### Task 4: JS feature-parity module (median-fill + StandardScaler) with golden fixtures

**Files:**
- Create: `web/lib/inference/features.ts`
- Create: `tests/fixtures/anomaly_parity.json` (Python-generated, committed)
- Modify: `tests/test_anomaly.py` (add a test that GENERATES the fixture and asserts it round-trips)
- Create: `web/lib/inference/__tests__/features.test.ts`

**Interfaces:**
- Produces `standardize(raw: number[], model: AnomalyModelLike): number[]` where `AnomalyModelLike = { medians: number[]; scaler: { mean: number[]; scale: number[] } }`. For each feature i: `x = isFinite(raw[i]) ? raw[i] : medians[i]; return (x - mean[i]) / scale[i]`.
- Consumes the exported `scaler`/`medians` from Task 1.

- [ ] **Step 1: Generate the golden fixture from Python**

Add to `tests/test_anomaly.py` a test that writes `tests/fixtures/anomaly_parity.json` with a fixed set of raw 5-feature inputs and the Python reference outputs (standardized vectors, IF `score_samples`, `predict` labels, z-scores, and z-verdicts) computed from the SAME fitted model that Task 1 exports. This fixture is committed and consumed by both Python and vitest.

```python
def test_write_parity_fixture(tmp_path=None):
    import json
    from pathlib import Path
    import numpy as np
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from weather_forecast.anomaly import DEFAULT_IF_FEATURES
    from weather_forecast.data_loader import load_raw_weather

    root = Path(__file__).resolve().parents[1]
    df = load_raw_weather(root)
    feats = list(DEFAULT_IF_FEATURES)
    X = df[feats].astype(float)
    medians = X.median()
    scaler = StandardScaler().fit(X.fillna(medians))
    iso = IsolationForest(n_estimators=200, contamination=0.02, random_state=42, n_jobs=-1).fit(
        scaler.transform(X.fillna(medians))
    )
    temp = df["temperature_celsius"].astype(float)
    mu, sigma = float(temp.mean()), max(float(temp.std(ddof=0)), 1e-9)

    # a fixed set of raw inputs spanning normal and extreme
    inputs = [
        [15.0, 60.0, 10.0, 1013.0, 0.0],
        [45.0, 5.0, 2.0, 990.0, 0.0],
        [-30.0, 95.0, 50.0, 1040.0, 30.0],
        [float("nan"), 50.0, 12.0, 1010.0, 1.0],
    ]
    std = scaler.transform(np.nan_to_num(np.array(inputs), nan=np.array(medians)))
    fixture = {
        "inputs": inputs,
        "standardized": std.tolist(),
        "if_score_samples": iso.score_samples(std).tolist(),
        "if_predict": iso.predict(std).tolist(),
        "z": [((row[0] if row[0] == row[0] else mu) - mu) / sigma for row in inputs],
    }
    fixture["z_is_anomaly"] = [abs(z) > 3.0 for z in fixture["z"]]
    (root / "tests/fixtures/anomaly_parity.json").parent.mkdir(exist_ok=True)
    (root / "tests/fixtures/anomaly_parity.json").write_text(json.dumps(fixture, indent=2) + "\n")
    assert len(fixture["standardized"]) == len(inputs)
```

Run: `PYTHONPATH=src python -m pytest tests/test_anomaly.py::test_write_parity_fixture -v` to write the committed fixture.

- [ ] **Step 2: Write the failing TS feature test**

Create `web/lib/inference/__tests__/features.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { standardize } from '../features';
import model from '../../../public/data/anomaly_model.json';

const fx = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/anomaly_parity.json', import.meta.url), 'utf8'));

describe('standardize parity', () => {
  it('matches Python StandardScaler within 1e-6', () => {
    fx.inputs.forEach((raw: number[], i: number) => {
      const got = standardize(raw, model);
      got.forEach((v, j) => expect(Math.abs(v - fx.standardized[i][j])).toBeLessThan(1e-6));
    });
  });
});
```

- [ ] **Step 3: Run it to fail**

Run: `npm --prefix web test`
Expected: FAIL (no `../features` module).

- [ ] **Step 4: Implement `features.ts`**

```ts
export interface AnomalyModelLike {
  medians: number[];
  scaler: { mean: number[]; scale: number[] };
}

// Median-fill then StandardScaler, matching src/weather_forecast/anomaly.py exactly.
export function standardize(raw: number[], model: AnomalyModelLike): number[] {
  const { medians } = model;
  const { mean, scale } = model.scaler;
  return raw.map((x, i) => {
    const filled = Number.isFinite(x) ? x : medians[i];
    return (filled - mean[i]) / scale[i];
  });
}
```

- [ ] **Step 5: Run green**

Run: `npm --prefix web test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/inference/features.ts web/lib/inference/__tests__/features.test.ts tests/fixtures/anomaly_parity.json tests/test_anomaly.py
git commit -m "feat(web): standardize features in JS with Python parity"
```

---

### Task 5: JS Isolation Forest score_samples + predict + z-score with exact parity

**Files:**
- Create: `web/lib/inference/isolationForest.ts`
- Create: `web/lib/inference/zscore.ts`
- Create: `web/lib/inference/__tests__/isolationForest.test.ts`

**Interfaces:**
- Produces `scoreSamples(scaled: number[], forest: Forest): number` and `predictIsAnomaly(scaled: number[], forest: Forest): boolean` where `Forest = { max_samples: number; offset: number; trees: Tree[] }`, `Tree = { feature: number[]; threshold: number[]; children_left: number[]; children_right: number[]; n_node_samples: number[] }`.
- Produces `zscore(temp: number, z: { mu: number; sigma: number; threshold: number }): { z: number; isAnomaly: boolean }`.

- [ ] **Step 1: Write the failing parity test**

Create `web/lib/inference/__tests__/isolationForest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scoreSamples, predictIsAnomaly } from '../isolationForest';
import { zscore } from '../zscore';
import model from '../../../public/data/anomaly_model.json';

const fx = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/anomaly_parity.json', import.meta.url), 'utf8'));

describe('isolation forest parity', () => {
  it('score_samples matches Python within 1e-6 and predict matches exactly', () => {
    fx.standardized.forEach((scaled: number[], i: number) => {
      expect(Math.abs(scoreSamples(scaled, model.isolation_forest) - fx.if_score_samples[i])).toBeLessThan(1e-6);
      const isAnom = predictIsAnomaly(scaled, model.isolation_forest);
      expect(isAnom).toBe(fx.if_predict[i] === -1);
    });
  });
  it('zscore matches Python exactly', () => {
    fx.inputs.forEach((raw: number[], i: number) => {
      const { z, isAnomaly } = zscore(raw[0], model.zscore);
      // NaN temperature falls back to mu -> z 0 in the fixture
      const expected = fx.z[i];
      if (Number.isFinite(raw[0])) expect(Math.abs(z - expected)).toBeLessThan(1e-9);
      expect(isAnomaly).toBe(fx.z_is_anomaly[i]);
    });
  });
});
```

- [ ] **Step 2: Run it to fail**

Run: `npm --prefix web test`
Expected: FAIL (no modules).

- [ ] **Step 3: Implement `isolationForest.ts`** (exact reproduction of sklearn `IsolationForest._compute_score_samples`)

```ts
export interface Tree {
  feature: number[];
  threshold: number[];
  children_left: number[];
  children_right: number[];
  n_node_samples: number[];
}
export interface Forest {
  max_samples: number;
  offset: number;
  trees: Tree[];
}

const EULER_GAMMA = 0.5772156649015329;

// sklearn _average_path_length: expected path length of an unsuccessful BST search over n points.
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_GAMMA) - (2 * (n - 1)) / n;
}

// Depth to the leaf reached by `scaled` in one isolation tree, plus the leaf's average-path-length
// correction (matching sklearn: node depth + _average_path_length(n_node_samples[leaf])).
function treePathLength(scaled: number[], t: Tree): number {
  let node = 0;
  let depth = 0;
  while (t.children_left[node] !== -1) {
    // sklearn: feature == -2 marks a leaf; children_left == -1 also marks a leaf.
    if (t.feature[node] === -2) break;
    node = scaled[t.feature[node]] <= t.threshold[node] ? t.children_left[node] : t.children_right[node];
    depth += 1;
  }
  return depth + averagePathLength(t.n_node_samples[node]);
}

export function scoreSamples(scaled: number[], forest: Forest): number {
  let sum = 0;
  for (const t of forest.trees) sum += treePathLength(scaled, t);
  const meanDepth = sum / forest.trees.length;
  const c = averagePathLength(forest.max_samples);
  // sklearn returns score_samples = -2 ** (-mean_depth / c)
  return -(2 ** (-meanDepth / c));
}

// predict: anomaly where score_samples - offset < 0, i.e. score_samples < offset.
export function predictIsAnomaly(scaled: number[], forest: Forest): boolean {
  return scoreSamples(scaled, forest) - forest.offset < 0;
}
```

Note for the implementer: verify the leaf-detection convention against a real exported tree (sklearn marks leaves with `children_left[node] === -1` and `feature[node] === -2`); the loop above stops on either. If the 1e-6 parity misses, the usual cause is the `-1` correction term - sklearn's exact formula is `node_depth + _average_path_length(n_node_samples[leaf])` summed, with NO extra global `-1` in current sklearn (older code subtracted 1); trust the golden fixture and adjust the formula until parity holds, keeping the change documented in a comment.

- [ ] **Step 4: Implement `zscore.ts`**

```ts
export interface ZParams { mu: number; sigma: number; threshold: number; }

export function zscore(temp: number, z: ZParams): { z: number; isAnomaly: boolean } {
  const value = Number.isFinite(temp) ? temp : z.mu;
  const zv = (value - z.mu) / z.sigma;
  return { z: zv, isAnomaly: Math.abs(zv) > z.threshold };
}
```

- [ ] **Step 5: Run to green (iterate the IF formula against the fixture until parity holds)**

Run: `npm --prefix web test`
Expected: PASS at 1e-6. If the IF test fails on a constant offset, adjust `treePathLength`/`scoreSamples` per the Step 3 note and re-run; do not loosen the tolerance.

- [ ] **Step 6: Commit**

```bash
git add web/lib/inference/isolationForest.ts web/lib/inference/zscore.ts web/lib/inference/__tests__/isolationForest.test.ts
git commit -m "feat(web): reproduce Isolation Forest scoring and z-score in JS with parity"
```

---

### Task 6: The `AnomalyModel` loader and type

**Files:**
- Modify: `web/lib/contract.ts` (add the type + a standalone loader, copying the `loadAnomalyEmbeddings` pattern)

**Interfaces:**
- Produces `AnomalyModel` (mirrors `anomaly_model.schema.json` required fields) and `loadAnomalyModel(): Promise<AnomalyModel>`.

- [ ] **Step 1: Add the type and loader**

In `web/lib/contract.ts`, after the `AnomalyEmbeddings` block, add an `AnomalyModel` interface mirroring the schema (features, scaler, medians, feature_ranges, zscore, isolation_forest with its Tree shape) and:

```ts
export async function loadAnomalyModel(): Promise<AnomalyModel> {
  const res = await fetch('/data/anomaly_model.json');
  if (!res.ok) throw new Error(`Failed to load anomaly_model.json: ${res.status}`);
  return (await res.json()) as AnomalyModel;
}
```

- [ ] **Step 2: Build to typecheck**

Run: `npm --prefix web run build`
Expected: build succeeds, TypeScript clean.

- [ ] **Step 3: Commit**

```bash
git add web/lib/contract.ts
git commit -m "feat(web): add the anomaly-model loader and type"
```

---

### Task 7: The live anomaly-checker panel (five sliders, three read-outs)

**Files:**
- Create: `web/components/anomalies/AnomalyChecker.tsx`
- Modify: `web/components/anomalies/AnomaliesSection.tsx` (mount the panel in the `ready` block, pass `mapRef`)
- Modify: `web/components/anomalies/anomalies.css` (add an `.anomaly-checker*` block)

**Interfaces:**
- Consumes `loadAnomalyModel` (Task 6), `standardize` (Task 4), `scoreSamples`/`predictIsAnomaly` (Task 5), `zscore` (Task 5), and `mapRef: RefObject<AnomalyMapHandle | null>` (Task 8 extends the handle).
- Props: `{ mapRef: RefObject<AnomalyMapHandle | null> }` (same shape as `SemanticSearch`).

- [ ] **Step 1: Build the component (mirror `SemanticSearch`'s shape)**

Create `AnomalyChecker.tsx`: on mount `loadAnomalyModel()` into state; render five labeled range inputs (temperature, humidity, wind_kph, pressure_mb, precip_mm) whose min/max come from `model.feature_ranges`; keep the five values in state initialized to each feature's midpoint. On every change, compute `scaled = standardize(values, model)`, then `zscore(values[0], model.zscore)`, `predictIsAnomaly(scaled, model.isolation_forest)` + `scoreSamples(...)`, and derive overlap (both z and IF flag). Render three read-outs (z-score verdict + value, Isolation Forest verdict + score, an overlap badge when both agree) and a visually-hidden table equivalent of the three verdicts. Every slider is keyboard-reachable with a visible focus ring; guard all transitions behind `prefers-reduced-motion`. Do NOT fetch anything after the initial model load.

- [ ] **Step 2: Mount it in the section**

In `AnomaliesSection.tsx`, inside the `status === 'ready'` block, render `<AnomalyChecker mapRef={mapRef} />` as a sibling before/after `<SemanticSearch mapRef={mapRef} />`.

- [ ] **Step 3: Style it**

Add an `.anomaly-checker` class block to `anomalies.css` (scoped, prefixed), consistent with the `.semantic-search` block and the Observatory tokens; include the reduced-motion and focus-visible rules.

- [ ] **Step 4: Build and manually smoke it**

Run: `npm --prefix web run build`
Expected: build succeeds. (Interactive behavior is verified in Task 9's browser gate.)

- [ ] **Step 5: Commit**

```bash
git add web/components/anomalies/AnomalyChecker.tsx web/components/anomalies/AnomaliesSection.tsx web/components/anomalies/anomalies.css
git commit -m "feat(web): add the live anomaly-checker panel"
```

---

### Task 8: Click-to-place a synthetic point on the map

**Files:**
- Modify: `web/components/anomalies/AnomalyMap.tsx` (extend the handle + add a synthetic source/layer + a general click handler)
- Modify: `web/components/anomalies/AnomalyChecker.tsx` (place/clear the point; context-only copy)

**Interfaces:**
- Extends `AnomalyMapHandle` with `placeSyntheticPoint(lat: number, lon: number, tempC: number, method: 'zscore' | 'isolation_forest' | 'both' | 'none'): void` and `clearSyntheticPoint(): void`, plus a prop `onMapClick?: (lat: number, lon: number) => void`.

- [ ] **Step 1: Add the synthetic source/layer (copy the `sem-highlights` pattern)**

In `AnomalyMap.tsx`, add a dedicated GeoJSON source `SRC_SYNTH = 'synthetic-point'` and a layer pair (a ring + a temperature-colored dot) exactly as `SRC_SEM`/`LAYER_SEM_*` are wired, initialized empty. Add `placeSyntheticPoint`/`clearSyntheticPoint` to the `useImperativeHandle` object, setting the source data (colour by the passed `tempC` via the existing `tempColorExpr` inputs, shape/stroke by the passed `method`). Add a general `map.on('click', (e) => { if (e.defaultPrevented) return; onMapClick?.(e.lngLat.lat, e.lngLat.lng); })` that does NOT double-fire with the existing `LAYER_HIT` click handler (call `e.preventDefault()` in the layer-scoped handler, or hit-test).

- [ ] **Step 2: Drive it from the checker**

In `AnomalyChecker.tsx`, accept the click: when the visitor clicks the map (via the `onMapClick` wired through `AnomaliesSection` or a new imperative call), store the lat/lon and call `mapRef.current?.placeSyntheticPoint(lat, lon, values[0], method)` where `method` is derived from the current verdicts (`both` when both flag, else whichever flags, else `none`). Add copy stating plainly that the location is only context and the model judges the weather values, not the place. Provide a clear/reset control.

- [ ] **Step 3: Build**

Run: `npm --prefix web run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/components/anomalies/AnomalyMap.tsx web/components/anomalies/AnomalyChecker.tsx
git commit -m "feat(web): place the checker's synthetic observation on the map"
```

---

### Task 9: Integration verification, browser gate, and PR

**Files:** none (verification only)

- [ ] **Step 1: Full Python + web suites**

Run: `PYTHONPATH=src python -m pytest -q` and `npm --prefix web test`
Expected: both green, including the parity tests at 1e-6.

- [ ] **Step 2: Build + checks**

Run: `npm --prefix web run build && npm --prefix web run check`
Expected: build succeeds, `redesign check passed`.

- [ ] **Step 3: Contract-swap-changes-zero-ts (ADR-D)**

Regenerate the artifact (`PYTHONPATH=src python scripts/_gen_anomaly_model.py`) and confirm no `.ts`/`.tsx` file changed: `git status --porcelain 'web/**/*.ts' 'web/**/*.tsx'` is empty.

- [ ] **Step 4: Browser gate (serve `out/`, both themes)**

Serve `web/out` and verify: moving each slider updates the three read-outs live with ZERO network requests after load (check the network panel); clicking the map places a synthetic point with the standard colour/shape encoding and shows the context-only copy; keyboard reaches every slider with a visible focus ring; `prefers-reduced-motion` disables checker animation; light and dark both render with zero console errors.

- [ ] **Step 5: Open the PR**

Write the PR body per `.standards/github.md` PR model (Context, What Was Done, How to Test, Evidence, PR Review Checklist). Push (with the venv on PATH and `PYTHONPATH=src` so the pre-push hook's pytest resolves) and open the PR against main. Stop for the owner's review.
