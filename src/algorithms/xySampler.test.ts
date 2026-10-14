import { expect, it } from 'vitest';
import { createRng } from './rng';
import { drawXYConditional, xyTransition } from './xySampler';
import { xyModel, rotateXY, wrapXY, xyAction } from '../models/xy';
import { xyGraph } from '../domain/xyDomain';
import { angularQuadrature } from '../test/xyOracle';
function injected(values: number[]) {
  let count = 0;
  return {
    uniform: () => {
      if (count >= values.length) throw Error('unexpected draw');
      return values[count++]!;
    },
    count: () => count,
  };
}
it('three Metropolis draws in order: branch-crossing accepted and full-state rejection', () => {
  const m = xyModel({ h: 4, geometry: xyGraph('dimer', 4) });
  const a = new Float64Array([3.1, 0.2]),
    rng = injected([0.1, 0.9, 0.001]),
    old = xyAction(m, a);
  const trace = xyTransition(m, a, 'metropolis', 0.8, rng);
  expect(rng.count()).toBe(3);
  expect(trace.site).toBe(0);
  expect(trace.proposed).toBeLessThan(-2);
  expect(trace.outcome).toBe('accepted');
  expect(trace.actualDelta).toBeCloseTo(xyAction(m, a) - old, 12);
  const aligned = new Float64Array(2),
    reject = injected([0.1, 0.999, 0.999]);
  const t = xyTransition(m, aligned, 'metropolis', Math.PI, reject);
  expect(t.outcome).toBe('rejected');
  expect(aligned).toEqual(new Float64Array(2));
  expect(t.actualDelta).toBe(0);
  expect(reject.count()).toBe(3);
});
it('conditional rejection trials are not chain rejections; R=0 consumes one relative draw', () => {
  const rng = injected([0.99, 0.99, 0.5, 0.1]);
  const draw = drawXYConditional(4, 3.12, 0, rng);
  expect(draw.trials).toBe(2);
  expect(draw.draws).toBe(4);
  expect(draw.angle).toBeCloseTo(3.12, 13);
  const zero = drawXYConditional(0, null, 1, injected([0.5]));
  expect(zero.angle).toBe(1);
  expect(zero.draws).toBe(1);
  expect(() => drawXYConditional(20, 0, 0, { uniform: () => 0.99 }, 3)).toThrow(
    /safety bound/,
  );
  const m = xyModel({ h: 0, geometry: xyGraph('dimer', 0) }),
    state = new Float64Array(2);
  const t = xyTransition(m, state, 'heat-bath', 0.8, injected([0.8, 0.5]));
  expect(t.outcome).toBe('resampled');
  expect(t.draws).toBe(2);
  expect(t.probability).toBeNull();
  expect(t.actualDelta).toBe(0);
});
for (const R of [0, 0.001, 0.7, 4, 20, 68])
  it(`conditional multiseed distribution R=${R}, branch-crossing μ`, () => {
    const mu = 3.12,
      oracle = angularQuadrature(R, mu),
      bins = Array<number>(24).fill(0);
    let x = 0,
      y = 0,
      second = 0,
      draws = 0,
      trials = 0;
    for (const seed of [17, 271, 12345, 89231]) {
      const rng = createRng(seed);
      for (let i = 0; i < 6000; i++) {
        const d = drawXYConditional(R, mu, 0.4, rng);
        x += Math.cos(d.angle);
        y += Math.sin(d.angle);
        second += Math.cos(d.angle) ** 2;
        draws += d.draws;
        trials += d.trials;
        bins[
          Math.min(23, Math.floor(((d.angle + Math.PI) / (2 * Math.PI)) * 24))
        ]!++;
      }
    }
    expect(x / 24000).toBeCloseTo(oracle.x, 1);
    expect(y / 24000).toBeCloseTo(oracle.y, 1);
    expect(Math.abs(second / 24000 - oracle.second)).toBeLessThan(0.025);
    bins.forEach((b, i) =>
      expect(Math.abs(b / 24000 - oracle.bins[i]!)).toBeLessThan(0.02),
    );
    expect(draws).toBe(R === 0 ? trials : 2 * trials);
  });
for (const sampler of ['metropolis', 'heat-bath'] as const)
  it(`${sampler}: seeded pathwise global-rotation covariance and exact replay`, () => {
    for (const K of [0, -0.7, 0.7]) {
      const m = xyModel({ h: 0, geometry: xyGraph('torus', K) });
      const a = new Float64Array([0.2, -0.3, 1, -2]),
        b = rotateXY(a, 1.7),
        clone = a.slice();
      const rng = createRng(12345),
        other = createRng(12345),
        replay = createRng(12345);
      for (let i = 0; i < 500; i++) {
        const t = xyTransition(m, a, sampler, 0.8, rng),
          u = xyTransition(m, b, sampler, 0.8, other),
          v = xyTransition(m, clone, sampler, 0.8, replay);
        expect(t).toEqual(v);
        expect(t.draws).toBe(u.draws);
        expect(t.outcome).toBe(u.outcome);
        a.forEach((angle, j) =>
          expect(Math.abs(wrapXY(b[j]! - angle - 1.7))).toBeLessThan(2e-10),
        );
      }
    }
  });
it('Metropolis flux equality from symmetric angular proposal and full actions', () => {
  const m = xyModel({ h: -0.7, geometry: xyGraph('triangle', -0.9) }),
    a = [0.1, -0.2, 1.2],
    b = [0.1, 0.4, 1.2];
  const sa = xyAction(m, a),
    sb = xyAction(m, b);
  expect(Math.exp(-sa) * Math.min(1, Math.exp(sa - sb))).toBeCloseTo(
    Math.exp(-sb) * Math.min(1, Math.exp(sb - sa)),
    14,
  );
});
