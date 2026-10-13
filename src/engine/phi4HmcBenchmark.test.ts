import { expect, it } from 'vitest';
import { FieldRun } from './fieldRun';
import type { FieldSegmentSnapshot } from './fieldRun';
import { defaultPhi4Field } from '../models/phi4Field';
import type { Phi4FieldParameters } from '../models/phi4Field';
import { createFieldLattice } from '../domain/fieldLattice';
import { exactGaussianField } from '../models/gaussianFieldReference';
import { drawGaussianField } from '../algorithms/gaussianFieldSampler';
import { hmcPhi4Transition } from '../algorithms/phi4Hmc';
import { createRng } from '../algorithms/rng';
import {
  decoupledPhi4Reference,
  spatialQmMapping,
} from '../models/phi4Reference';
import { quarticTransferStudy } from '../models/quarticTransfer';
import { dimerIntegral } from './testSupport/phi4Dimer';

const seeds = [1203, 9041, 19383, 47017];
const mean = (xs: number[]) => xs.reduce((a, v) => a + v, 0) / xs.length;
const base = { ...defaultPhi4Field, r: 1, lambda: 1, kappaX: 1, source: 0 };
const tune = { kind: 'hmc' as const, stepSize: 0.06, leapfrogSteps: 12 };
/** Four independent chains, 500 warm-up, 2500 retained at stride 3 by default.
 * Fixed broad correlated-chain tolerances below are declared before running;
 * they are regression gates, not independent-sample uncertainty intervals. */
function ensemble(
  parameters: Phi4FieldParameters,
  options = { warmup: 500, samples: 2500, stride: 3, sampler: tune },
) {
  const rows: FieldSegmentSnapshot[] = [];
  let fourth = 0,
    seen = 0;
  const size = createFieldLattice(parameters.shape).size;
  for (const seed of seeds) {
    const run = new FieldRun(1, {
      model: 'phi4-field',
      parameters,
      sampler: options.sampler,
      warmupTrajectories: options.warmup,
      strideTrajectories: options.stride,
      seed,
    });
    let remaining = options.warmup + options.samples * options.stride,
      lastUpdate = 0;
    while (remaining) {
      const count = Math.min(32, remaining);
      run.advance(count);
      remaining -= count;
      // <=32 new measurements per batch, so every fourth-moment contribution
      // is collected exactly once before bounded worker vectors are evicted.
      const segment = run.snapshot().segments[0]!;
      for (const record of segment.recent)
        if (record.update > lastUpdate) {
          fourth += mean(record.field.map((x) => x ** 4));
          seen++;
        }
      lastUpdate = segment.recent.at(-1)?.update ?? lastUpdate;
    }
    const row = run.snapshot().segments[0]!;
    expect(row.measurements).toBe(options.samples);
    expect(row.hmc?.divergences).toBe(0);
    rows.push(row);
  }
  const average = (f: (s: FieldSegmentSnapshot) => number) => mean(rows.map(f));
  const result = {
    mean: average((s) => s.average.mean!),
    second: average((s) => mean(s.sites.map((v) => v.secondMoment!))),
    siteFourth: fourth / seen,
    m2: average((s) => s.average.secondMoment!),
    m4: average((s) => s.averageFourthMoment!),
    action: average((s) => s.actionDensity.mean!) * size,
    acceptance: average((s) => s.accepted / s.updates),
    gradientEvaluations: average((s) => s.hmc!.gradientEvaluations),
    sites: Array.from({ length: size }, (_, i) =>
      average((s) => s.sites[i]!.mean!),
    ),
    seconds: Array.from({ length: size }, (_, i) =>
      average((s) => s.sites[i]!.secondMoment!),
    ),
    pairs: Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) =>
        average((s) => s.pairProducts[i]![j]!),
      ),
    ),
  };
  expect(result.acceptance).toBeGreaterThan(0.7);
  return result;
}
function close(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}
function report(name: string, result: unknown) {
  console.info('M4d2 benchmark', name, JSON.stringify(result));
}

it('matches anisotropic periodic 2×2 Gaussian eigenmode moments and an open Gaussian field', () => {
  const parameters = {
    ...base,
    shape: {
      kind: 'rectangle' as const,
      lx: 2,
      ly: 2,
      periodicX: true,
      periodicY: true,
    },
    r: 2,
    lambda: 0,
    kappaX: 1,
    kappaY: 0.5,
    source: 0.4,
  };
  for (const periodic of [true, false]) {
    const p = {
        ...parameters,
        shape: {
          ...parameters.shape,
          periodicX: periodic,
          periodicY: periodic,
        },
      },
      reference = exactGaussianField(p),
      s = ensemble(p);
    if (periodic) {
      // Independent 2×2 Fourier signs and eigenvalues 2,6,4,8 preserve parallel bonds.
      const diagonal = (1 / 2 + 1 / 6 + 1 / 4 + 1 / 8) / 4,
        cx = (1 / 2 - 1 / 6 + 1 / 4 - 1 / 8) / 4,
        cy = (1 / 2 + 1 / 6 - 1 / 4 - 1 / 8) / 4;
      expect(reference.covariance[0]![0]).toBeCloseTo(diagonal, 13);
      expect(reference.covariance[0]![1]).toBeCloseTo(cx, 13);
      expect(reference.covariance[0]![2]).toBeCloseTo(cy, 13);
    }
    for (let i = 0; i < 4; i++) {
      close(s.sites[i]!, 0.2, 0.035);
      close(s.seconds[i]!, reference.covariance[i]![i]! + 0.04, 0.04);
    }
    for (const j of [1, 2]) {
      close(s.pairs[0]![j]!, reference.covariance[0]![j]! + 0.04, 0.035);
      close(
        s.pairs[0]![j]! - s.sites[0]! * s.sites[j]!,
        reference.covariance[0]![j]!,
        0.035,
      );
    }
    close(s.m2, 0.165, 0.025);
    close(s.m4, 0.078475, 0.025);
    report(periodic ? 'Gaussian periodic 2×2' : 'Gaussian open 2×2', {
      sample: s,
      reference: {
        mean: 0.2,
        second: reference.covariance[0]![0]! + 0.04,
        pairX: reference.covariance[0]![1]! + 0.04,
        pairY: reference.covariance[0]![2]! + 0.04,
        m2: 0.165,
        m4: 0.078475,
      },
    });
  }
}, 60000);

it('preserves independent exact Gaussian equilibrium under one corrected trajectory', () => {
  const p = {
      ...base,
      shape: {
        kind: 'rectangle' as const,
        lx: 2,
        ly: 2,
        periodicX: true,
        periodicY: true,
      },
      r: 2,
      lambda: 0,
      kappaX: 1,
      kappaY: 0.5,
      source: 0.4,
    },
    lattice = createFieldLattice(p.shape),
    reference = exactGaussianField(p);
  const sums = Array<number>(4).fill(0),
    squares = Array<number>(4).fill(0);
  let pair = 0,
    accepted = 0;
  for (const seed of seeds) {
    const exactRng = createRng(seed),
      productionRng = createRng(seed + 1000000);
    for (let i = 0; i < 3000; i++) {
      const start = drawGaussianField(reference, exactRng),
        result = hmcPhi4Transition(lattice, p, start, tune, productionRng);
      accepted += Number(result.trace.accepted);
      result.field.forEach((x, j) => {
        sums[j]! += x;
        squares[j]! += x * x;
      });
      pair += result.field[0]! * result.field[1]!;
    }
  }
  sums.forEach((v, j) => {
    close(v / 12000, 0.2, 0.025);
    close(squares[j]! / 12000, reference.covariance[j]![j]! + 0.04, 0.025);
  });
  close(pair / 12000, reference.covariance[0]![1]! + 0.04, 0.025);
  report('independent Gaussian invariance', {
    means: sums.map((v) => v / 12000),
    seconds: squares.map((v) => v / 12000),
    pair: pair / 12000,
    acceptance: accepted / 12000,
  });
}, 60000);

it('matches symmetric and tilted independent quartic site and field-average moments', () => {
  for (const source of [0, 0.3]) {
    const p = {
        ...base,
        shape: { kind: 'chain' as const, length: 4, periodic: true },
        kappaX: 0,
        source,
      },
      q = decoupledPhi4Reference(p).site,
      s = ensemble(p);
    // Integration by parts gives r E[x]+λ E[x³]−j=0. Expand (Σx)^4
    // by index multiplicities to obtain an independent tilted m⁴ reference.
    const V = 4,
      m1 = q.mean,
      m2 = q.secondMoment,
      m3 = (source - p.r * m1) / p.lambda,
      m4 = q.fourthMoment;
    const average2 = (m2 + (V - 1) * m1 * m1) / V;
    const average4 =
      (V * m4 +
        4 * V * (V - 1) * m3 * m1 +
        3 * V * (V - 1) * m2 * m2 +
        6 * V * (V - 1) * (V - 2) * m2 * m1 * m1 +
        V * (V - 1) * (V - 2) * (V - 3) * m1 ** 4) /
      V ** 4;
    close(s.mean, m1, 0.03);
    close(s.second, m2, 0.04);
    close(s.siteFourth, m4, 0.065);
    close(s.pairs[0]![1]!, m1 * m1, 0.035);
    close(s.m2, average2, 0.025);
    close(s.m4, average4, 0.02);
    report('decoupled quartic', {
      source,
      sample: s,
      reference: {
        mean: m1,
        second: m2,
        fourth: m4,
        pair: m1 * m1,
        m2: average2,
        m4: average4,
      },
    });
  }
}, 60000);

it('matches independently refined coupled dimer integrals including both periodic bonds', () => {
  for (const periodic of [false, true]) {
    const fine = dimerIntegral(160, 4, periodic),
      wide = dimerIntegral(200, 5, periodic);
    for (const key of Object.keys(fine) as (keyof typeof fine)[])
      expect(wide[key]).toBeCloseTo(fine[key], 9);
    const p = {
        ...base,
        shape: { kind: 'chain' as const, length: 2, periodic },
        kappaX: 0.7,
        source: 0.2,
      },
      s = ensemble(p);
    close(s.mean, wide.mean, 0.035);
    close(s.second, wide.second, 0.035);
    close(s.pairs[0]![1]!, wide.pair, 0.03);
    close(s.action, wide.action, 0.06);
    report('coupled dimer', { periodic, sample: s, reference: wide });
  }
}, 60000);

it('matches the mandatory interacting N=16 periodic-chain finite-ring transfer reference', () => {
  const study = quarticTransferStudy(
    spatialQmMapping(defaultPhi4Field).parameters!,
  );
  expect(study.correlatorStatus).toBe('resolved');
  const s = ensemble(defaultPhi4Field, {
    warmup: 800,
    samples: 4000,
    stride: 4,
    sampler: { kind: 'hmc', stepSize: 0.08, leapfrogSteps: 16 },
  });
  const pair = mean(s.pairs.map((row, i) => row[(i + 1) % 16]!)),
    reference = study.grids[2].rawCorrelator!;
  close(s.second, reference[0]!, 0.08);
  close(pair, reference[1]!, 0.08);
  report('periodic N16 double well', {
    sample: {
      mean: s.mean,
      C0: s.second,
      C1: pair,
      acceptance: s.acceptance,
      gradientEvaluations: s.gradientEvaluations,
    },
    reference: reference.slice(0, 2),
  });
}, 60000);

it('checks moderate 4×4 interaction symmetry and finite moments, with local sampling only a secondary comparison', () => {
  const p = {
      ...base,
      shape: {
        kind: 'rectangle' as const,
        lx: 4,
        ly: 4,
        periodicX: true,
        periodicY: true,
      },
      kappaY: 1,
    },
    s = ensemble(p);
  close(s.mean, 0, 0.05);
  for (const m of s.sites) close(m, 0, 0.08);
  expect(s.second).toBeGreaterThan(0.1);
  expect(s.second).toBeLessThan(1);
  expect(s.siteFourth).toBeGreaterThan(s.second ** 2);
  expect(Number.isFinite(s.m4)).toBe(true);
  const local = seeds.map((seed) => {
    const run = new FieldRun(1, {
      model: 'phi4-field',
      parameters: p,
      sampler: { kind: 'metropolis', width: 1.5 },
      warmupSweeps: 800,
      strideSweeps: 3,
      seed,
    });
    let remaining = (800 + 3000 * 3) * 16;
    while (remaining) {
      const n = Math.min(1024, remaining);
      run.advance(n);
      remaining -= n;
    }
    return mean(run.snapshot().segments[0]!.sites.map((v) => v.secondMoment!));
  });
  close(s.second, mean(local), 0.05);
  report('4×4 exploratory', {
    mean: s.mean,
    second: s.second,
    siteFourth: s.siteFourth,
    m2: s.m2,
    m4: s.m4,
    acceptance: s.acceptance,
    gradientEvaluations: s.gradientEvaluations,
    localSecond: mean(local),
  });
}, 60000);
