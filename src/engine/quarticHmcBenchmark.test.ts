import { describe, expect, it } from 'vitest';
import {
  harmonicLimitReference,
  quarticTransferStudy,
} from '../models/quarticTransfer';
import { quarticQuadraticPart } from '../models/quarticOscillator';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import { FieldRun } from './fieldRun';

function sampleEnsemble(p: QuarticOscillatorParameters) {
  // Four independent seeded chains. The stride reduces, but does not remove,
  // serial dependence; these loose deterministic gates are not error bars.
  const records = [1203, 9041, 19383, 47017].map((seed, index) => {
    const run = new FieldRun(index + 1, {
      model: 'quartic-oscillator',
      quartic: p,
      parameters: quarticQuadraticPart(p),
      sampler: { kind: 'hmc', stepSize: 0.08, leapfrogSteps: 14 },
      warmupTrajectories: 300,
      strideTrajectories: 4,
      seed,
    });
    let remaining = 300 + 4 * 550;
    while (remaining > 0) {
      const count = Math.min(32, remaining);
      run.advance(count);
      remaining -= count;
    }
    const segment = run.snapshot().segments[0]!;
    expect(segment.measurements).toBe(550);
    const correlation = (lag: number) =>
      Array.from(
        { length: p.sites },
        (_, site) => segment.pairProducts[site]![(site + lag) % p.sites]!,
      ).reduce((sum, value) => sum + value, 0) / p.sites;
    return {
      mean: segment.average.mean!,
      correlations: [0, 1, 2].map(correlation),
      acceptance: segment.accepted / segment.updates,
    };
  });
  return {
    mean:
      records.reduce((sum, record) => sum + record.mean, 0) / records.length,
    correlations: [0, 1, 2].map(
      (lag) =>
        records.reduce((sum, record) => sum + record.correlations[lag]!, 0) /
        records.length,
    ),
    acceptance:
      records.reduce((sum, record) => sum + record.acceptance, 0) /
      records.length,
  };
}

describe('multi-seed HMC equilibrium checks', () => {
  it('matches exact finite-lattice Gaussian mean, variance and two lags', () => {
    const p = { sites: 8, beta: 4, r: 1, lambda: 0, h: 0.4 };
    const sampled = sampleEnsemble(p);
    const exact = [0, 1, 2].map((lag) => harmonicLimitReference(p, lag).raw);
    expect(sampled.acceptance).toBeGreaterThan(0.7);
    expect(Math.abs(sampled.mean - p.h / p.r)).toBeLessThan(0.08);
    expect(
      Math.abs(
        sampled.correlations[0]! -
          sampled.mean ** 2 -
          (exact[0]! - (p.h / p.r) ** 2),
      ),
    ).toBeLessThan(0.09);
    for (const lag of [1, 2])
      expect(Math.abs(sampled.correlations[lag]! - exact[lag]!)).toBeLessThan(
        0.09,
      );
  });

  it('matches an independently resolved moderate quartic transfer correlator', () => {
    const p = { sites: 8, beta: 4, r: 1, lambda: 1, h: 0 };
    const transfer = quarticTransferStudy(p);
    expect(transfer.correlatorStatus).toBe('resolved');
    const reference = transfer.grids[2].rawCorrelator!;
    const sampled = sampleEnsemble(p);
    expect(sampled.acceptance).toBeGreaterThan(0.7);
    expect(Math.abs(sampled.correlations[0]! - reference[0]!)).toBeLessThan(
      0.08,
    );
    expect(Math.abs(sampled.correlations[1]! - reference[1]!)).toBeLessThan(
      0.08,
    );
  });
});
