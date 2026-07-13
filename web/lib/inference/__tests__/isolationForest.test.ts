import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scoreSamples, predictIsAnomaly } from '../isolationForest';
import { zscore } from '../zscore';
import model from '../../../public/data/anomaly_model.json';

// Reference vectors from scripts/_gen_parity_fixture.py, computed from the same fit that
// anomaly_model.json serializes. Standardized rows feed the forest; raw temperatures feed z-score.
const fx = JSON.parse(
  readFileSync(new URL('../../../../tests/fixtures/anomaly_parity.json', import.meta.url), 'utf8'),
);

describe('isolation forest parity', () => {
  it('score_samples matches Python within 1e-6 and predict matches exactly', () => {
    fx.standardized.forEach((scaled: number[], i: number) => {
      expect(
        Math.abs(scoreSamples(scaled, model.isolation_forest) - fx.if_score_samples[i]),
      ).toBeLessThan(1e-6);
      expect(predictIsAnomaly(scaled, model.isolation_forest)).toBe(fx.if_predict[i] === -1);
    });
  });

  it('zscore matches Python exactly', () => {
    fx.inputs.forEach((raw: number[], i: number) => {
      const { z, isAnomaly } = zscore(raw[0], model.zscore);
      // A missing temperature (JSON null) falls back to mu -> z 0, so only assert the value
      // when the input is finite; the verdict is always checked.
      if (Number.isFinite(raw[0])) expect(Math.abs(z - fx.z[i])).toBeLessThan(1e-9);
      expect(isAnomaly).toBe(fx.z_is_anomaly[i]);
    });
  });
});
