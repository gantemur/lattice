import { expect, it } from 'vitest';
import { FieldRun, defaultPhi4Configuration } from './fieldRun';
import type { Phi4FieldParameters } from '../models/phi4Field';
import { exactGaussianField } from '../models/gaussianFieldReference';
import {
  decoupledPhi4Reference,
  spatialQmMapping,
} from '../models/phi4Reference';
import { quarticTransferStudy } from '../models/quarticTransfer';
import { phi4Correlations } from '../observables/phi4Correlator';

// Test-only tensor-product midpoint quadrature: explicit dimer action, no
// production geometry/action/local-difference call. Refining spacing and then
// cutoff separately prevents a coincidentally stable truncated answer.
function dimerIntegral(nodes: number, cutoff: number, periodic: boolean) {
  const step = (2 * cutoff) / nodes;
  let z = 0,
    mean = 0,
    second = 0,
    pair = 0,
    action = 0;
  for (let i = 0; i < nodes; i++)
    for (let k = 0; k < nodes; k++) {
      const x = -cutoff + (i + 0.5) * step,
        y = -cutoff + (k + 0.5) * step;
      const s =
        (x * x + y * y) / 2 +
        (x ** 4 + y ** 4) / 4 -
        0.2 * (x + y) +
        ((periodic ? 2 : 1) * 0.7 * (x - y) ** 2) / 2;
      const w = Math.exp(-s) * step * step;
      z += w;
      mean += w * x;
      second += w * x * x;
      pair += w * x * y;
      action += w * s;
    }
  return {
    logZ: Math.log(z),
    mean: mean / z,
    second: second / z,
    pair: pair / z,
    action: action / z,
  };
}
const seeds = [1203, 9041, 19383, 47017];
function ensemble(p: Phi4FieldParameters) {
  const size =
    p.shape.kind === 'chain' ? p.shape.length : p.shape.lx * p.shape.ly;
  let siteFourthSum = 0,
    observedFields = 0;
  const rows = seeds.map((seed) => {
    const run = new FieldRun(1, {
      ...defaultPhi4Configuration,
      parameters: p,
      seed,
      warmupSweeps: 1000,
      strideSweeps: 3,
      sampler: { kind: 'metropolis', width: 1.5 },
    });
    let lastMeasurementUpdate = 0;
    let remaining = (1000 + 6000 * 3) * size;
    while (remaining) {
      const batch = Math.min(1024, remaining);
      run.advance(batch);
      remaining -= batch;
      // At most 1024/(2*3)<256 measurements arrive per batch: inspect each
      // retained vector exactly once before eviction, without storing them.
      const recent = run.snapshot().segments[0]!.recent;
      for (const record of recent)
        if (record.update > lastMeasurementUpdate) {
          siteFourthSum +=
            record.field.reduce((sum, x) => sum + x ** 4, 0) / size;
          observedFields++;
        }
      lastMeasurementUpdate = recent.at(-1)?.update ?? lastMeasurementUpdate;
    }
    return run.snapshot().segments[0]!;
  });
  const average = (f: (s: (typeof rows)[number]) => number) =>
    rows.reduce((sum, s) => sum + f(s), 0) / rows.length;
  return {
    mean: average((s) => s.average.mean!),
    second: average(
      (s) => s.sites.reduce((a, v) => a + v.secondMoment!, 0) / size,
    ),
    fourthAverage: average((s) => s.averageFourthMoment!),
    siteFourth: siteFourthSum / observedFields,
    siteVariance: average(
      (s) => s.sites.reduce((sum, v) => sum + v.variance!, 0) / size,
    ),
    pair: average(
      (s) =>
        phi4Correlations(
          p.shape,
          s.pairProducts,
          s.sites.map((v) => v.mean!),
          p.source,
          'x',
        )[1]!.raw,
    ),
    action: average((s) => s.actionDensity.mean!),
    rows,
  };
}
it('independent coupled dimer integrals converge in spacing and cutoff, then match local chains', () => {
  for (const periodic of [false, true]) {
    const coarse = dimerIntegral(80, 4, periodic),
      fine = dimerIntegral(160, 4, periodic),
      wide = dimerIntegral(200, 5, periodic);
    for (const key of Object.keys(coarse) as (keyof typeof coarse)[]) {
      expect(fine[key]).toBeCloseTo(coarse[key], 9);
      expect(wide[key]).toBeCloseTo(fine[key], 9);
    }
    const p = {
      ...defaultPhi4Configuration.parameters,
      shape: { kind: 'chain' as const, length: 2, periodic },
      r: 1,
      lambda: 1,
      source: 0.2,
      kappaX: 0.7,
    };
    const sampled = ensemble(p);
    expect(Math.abs(sampled.mean - wide.mean)).toBeLessThan(0.035);
    expect(Math.abs(sampled.second - wide.second)).toBeLessThan(0.035);
    expect(Math.abs(sampled.pair - wide.pair)).toBeLessThan(0.03);
    expect(Math.abs(2 * sampled.action - wide.action)).toBeLessThan(0.06);
    console.info('φ⁴ dimer reference', periodic, {
      reference: wide,
      sampled: {
        mean: sampled.mean,
        second: sampled.second,
        pair: sampled.pair,
        action: 2 * sampled.action,
      },
    });
  }
});
it('benchmarks Gaussian, independent quartic and periodic transfer limits with four fixed seeds', () => {
  const base = {
    ...defaultPhi4Configuration.parameters,
    shape: { kind: 'chain' as const, length: 8, periodic: true },
    r: 1,
    lambda: 0,
    source: 0.2,
    kappaX: 1,
  };
  const gaussian = exactGaussianField(base),
    g = ensemble(base);
  expect(Math.abs(g.mean - 0.2)).toBeLessThan(0.04);
  expect(Math.abs(g.second - gaussian.covariance[0]![0]! - 0.04)).toBeLessThan(
    0.04,
  );
  expect(Math.abs(g.pair - gaussian.covariance[0]![1]! - 0.04)).toBeLessThan(
    0.04,
  );
  const independent = { ...base, lambda: 1, kappaX: 0, source: 0 };
  const exact = decoupledPhi4Reference(independent),
    d = ensemble(independent);
  expect(Math.abs(d.mean)).toBeLessThan(0.025);
  expect(Math.abs(d.second - exact.site.secondMoment)).toBeLessThan(0.035);
  expect(Math.abs(d.pair)).toBeLessThan(0.025);
  expect(Math.abs(d.siteFourth - exact.site.fourthMoment)).toBeLessThan(0.06);
  expect(Math.abs(d.siteVariance - exact.site.variance)).toBeLessThan(0.035);
  // E[m⁴]=[V E[x⁴]+3 V(V−1) E[x²]²]/V⁴ for centered independent sites.
  const fourth =
    (8 * exact.site.fourthMoment + 3 * 8 * 7 * exact.site.secondMoment ** 2) /
    8 ** 4;
  expect(Math.abs(d.fourthAverage - fourth)).toBeLessThan(0.004);
  const interacting = { ...base, lambda: 0.5, source: 0, kappaX: 2 };
  const study = quarticTransferStudy(spatialQmMapping(interacting).parameters!);
  expect(study.correlatorStatus).toBe('resolved');
  const q = ensemble(interacting),
    c = study.grids[2].rawCorrelator!;
  expect(Math.abs(q.second - c[0]!)).toBeLessThan(0.04);
  expect(Math.abs(q.pair - c[1]!)).toBeLessThan(0.04);
  console.info('φ⁴ limit benchmarks', {
    gaussian: {
      sample: [g.mean, g.second, g.pair],
      reference: [
        0.2,
        gaussian.covariance[0]![0]! + 0.04,
        gaussian.covariance[0]![1]! + 0.04,
      ],
    },
    decoupled: {
      sample: [d.mean, d.second, d.fourthAverage, d.siteFourth, d.siteVariance],
      reference: [
        0,
        exact.site.secondMoment,
        fourth,
        exact.site.fourthMoment,
        exact.site.variance,
      ],
    },
    transfer: { sample: [q.second, q.pair], reference: c.slice(0, 2) },
  });
});
