import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { standardize } from '../features';
import model from '../../../public/data/anomaly_model.json';

// Python-generated reference vectors (scripts/_gen_parity_fixture.py), from the same fit the
// shipped anomaly_model.json serializes. A missing input is JSON null; the scorer fills it.
const fx = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/anomaly_parity.json', import.meta.url), 'utf8'),
);

describe('standardize parity', () => {
  it('matches Python median-fill + StandardScaler within 1e-6', () => {
    fx.inputs.forEach((raw: number[], i: number) => {
      const got = standardize(raw, model);
      got.forEach((v, j) => expect(Math.abs(v - fx.standardized[i][j])).toBeLessThan(1e-6));
    });
  });
});
