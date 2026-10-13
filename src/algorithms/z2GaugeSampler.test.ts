import { expect, it } from 'vitest';
import { directGauge, metropolisGauge } from './z2GaugeSampler';
import { gaugeAction, gaugeModel, gaugeState } from '../models/z2Gauge';
import { exactGauge } from '../models/z2GaugeExact';
import { createRng } from './rng';

it('direct CDF consumes exactly one uniform and preserves its input', () => {
  const m = gaugeModel('torus', 0.7),
    r = exactGauge(m),
    before = gaugeState(m, 0);
  let count = 0;
  const result = directGauge(
    r,
    {
      uniform: () => {
        count++;
        return 0.9;
      },
    },
    m,
    before,
  );
  expect(count).toBe(1);
  expect(result.links).toEqual(r.states[r.cdf.findIndex((p) => p > 0.9)]);
  expect(before).toEqual(Array(8).fill(1));
});
it('three ordered draws distinguish accepted, rejected and self outcomes', () => {
  const m = gaugeModel('square', 1),
    before = gaugeState(m, 0);
  for (const [uniforms, kind] of [
    [[0.3, 0.8, 0.01], 'accepted'],
    [[0.3, 0.8, 0.99], 'rejected'],
    [[0.3, 0.1, 0.01], 'self'],
  ] as const) {
    let count = 0;
    const t = metropolisGauge(m, before, { uniform: () => uniforms[count++]! });
    expect(count).toBe(3);
    expect(t.kind).toBe(kind);
    expect(t.edgeId).toBe('e1');
    expect(t.proposedDelta).toBe(2);
    expect(t.probability).toBeCloseTo(Math.exp(-2));
    expect(t.actualDelta).toBeCloseTo(
      gaugeAction(m, t.links) - gaugeAction(m, before),
    );
    if (kind !== 'accepted') expect(t.links).toEqual(before);
  }
  expect(before).toEqual([1, 1, 1, 1]);
});
for (const geometry of ['square', 'torus'] as const)
  for (const K of [-0.7, 0, 0.7])
    it(`${geometry} K=${K}: independent full transition matrix detailed balance`, () => {
      const m = gaugeModel(geometry, K),
        r = exactGauge(m),
        E = m.domain.edges.length;
      // Independent action from raw face incidence and bit words, not the local delta.
      const action = (code: number) =>
        -K *
        m.domain.faces.reduce(
          (s, f) =>
            s +
            f.boundary.reduce(
              (p, e) => p * (code & (1 << Number(e.edgeId.slice(1))) ? -1 : 1),
              1,
            ),
          0,
        );
      const matrix = r.states.map((_, code) => {
        const row = Array(r.states.length).fill(0) as number[];
        row[code] = 0.5;
        for (let e = 0; e < E; e++) {
          const next = code ^ (1 << e),
            probability =
              Math.min(1, Math.exp(action(code) - action(next))) / (2 * E);
          row[next] = probability;
          row[code]! += 1 / (2 * E) - probability;
          expect(probability).toBeGreaterThan(0);
        }
        return row;
      });
      matrix.forEach((row, i) => {
        expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        expect(row[i]).toBeGreaterThanOrEqual(0.5);
        row.forEach((p, j) =>
          expect(r.probabilities[i]! * p).toBeCloseTo(
            r.probabilities[j]! * matrix[j]![i]!,
            12,
          ),
        );
      });
    });
it('seeded kernels replay exactly', () => {
  const m = gaugeModel('torus', 0.7),
    a = createRng(12345),
    b = createRng(12345);
  let x = gaugeState(m, 0),
    y = [...x];
  for (let i = 0; i < 100; i++) {
    const t = metropolisGauge(m, x, a),
      u = metropolisGauge(m, y, b);
    expect(t).toEqual(u);
    x = t.links;
    y = u.links;
  }
});
