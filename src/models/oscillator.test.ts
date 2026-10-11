import { describe, expect, it } from 'vitest';
import { createFieldLattice } from '../domain/fieldLattice';
import { fieldPrecision } from './gaussianField';
import { exactGaussianField } from './gaussianFieldReference';
import {
  oscillatorAction,
  oscillatorField,
  mappedOscillatorAction,
} from './oscillator';
import {
  continuumCorrelator,
  fourierCorrelator,
  latticeCorrelator,
  latticeGap,
  oscillatorEigenvalues,
  oscillatorPartition,
} from './oscillatorReference';
import {
  effectiveGap,
  pathCorrelator,
  segmentCorrelator,
} from '../observables/oscillatorCorrelator';
import { FieldRun } from '../engine/fieldRun';

const physical = { sites: 4, beta: 4, omega: 1 };

describe('periodic oscillator mathematics', () => {
  it('agrees with the independently written action and preserves two parallel bonds', () => {
    const p = { sites: 4, beta: 2, omega: 2 };
    const path = [1, -2, 0.5, 3];
    const a = p.beta / p.sites;
    const hand = path.reduce(
      (sum, x, j) =>
        sum +
        (path[(j + 1) % 4]! - x) ** 2 / (2 * a) +
        (a * p.omega ** 2 * x ** 2) / 2,
      0,
    );
    expect(oscillatorAction(p, path)).toBeCloseTo(hand, 12);
    expect(mappedOscillatorAction(p, path)).toBeCloseTo(hand, 12);
    const two = createFieldLattice({
      kind: 'chain',
      length: 2,
      periodic: true,
    });
    expect(two.bonds).toHaveLength(2);
    expect(
      fieldPrecision(two, { ...oscillatorField(p), shape: two.shape })[0],
    ).toEqual([6, -4]);
  });

  it('accepts physical parameters beyond the standalone Gaussian teaching bounds', () => {
    const p = { sites: 64, beta: 2, omega: 0.25 };
    const mapped = oscillatorField(p);
    expect(mapped.r).toBeLessThan(0.05);
    expect(mapped.kappaX).toBeGreaterThan(10);
    const run = new FieldRun(1, {
      model: 'oscillator',
      oscillator: p,
      parameters: mapped,
      sampler: { kind: 'spectral' },
      warmupSweeps: 0,
      strideSweeps: 1,
      seed: 123,
    });
    run.advance(2);
    expect(run.snapshot().segments[0]?.measurements).toBe(2);
  });

  it('matches dense covariance, the closed correlator and the precision spectrum', () => {
    const eigen = oscillatorEigenvalues(physical);
    expect(eigen[0]).toBeCloseTo(1);
    expect(eigen[1]).toBeCloseTo(3);
    const Q = fieldPrecision(
      createFieldLattice(oscillatorField(physical).shape),
      oscillatorField(physical),
    );
    expect(Q[0]).toEqual([3, -1, 0, -1]);
    const dense = exactGaussianField(oscillatorField(physical));
    const Fourier = fourierCorrelator(physical);
    for (let lag = 0; lag < 4; lag++) {
      expect(Fourier[lag]).toBeCloseTo(dense.covariance[0]![lag]!, 12);
      expect(Fourier[lag]).toBeCloseTo(latticeCorrelator(physical, lag), 12);
    }
    expect(Fourier[1]).toBeCloseTo(Fourier[3]!, 12);
    expect(Fourier[0]).toBeGreaterThan(0);
    expect(effectiveGap(Fourier.slice(0, 3), 1, 1, 4)).toBeCloseTo(
      latticeGap(physical),
      12,
    );
    expect(effectiveGap([1, 2, 1], 1, 1, 4)).toBeNull();
    expect(effectiveGap([1, 0, 1], 1, 1, 4)).toBeNull();
    const odd = { sites: 5, beta: 5, omega: 1 };
    expect(
      effectiveGap(fourierCorrelator(odd).slice(0, 3), 2, 1, 5),
    ).toBeCloseTo(latticeGap(odd), 12);
  });

  it('retains the fluctuating constant mode and the kinetic partition factor', () => {
    const eigen = oscillatorEigenvalues(physical);
    const averageVariance = 1 / (physical.sites * eigen[0]!);
    expect(averageVariance).toBeCloseTo(
      1 / (physical.beta * physical.omega ** 2),
      12,
    );
    const partition = oscillatorPartition(physical);
    expect(partition.logQuantum).toBeCloseTo(partition.logQuantumTransfer, 12);
    expect(partition.logRaw - partition.logQuantum).toBeCloseTo(
      (physical.sites * Math.log(2 * Math.PI)) / 2,
      12,
    );
  });

  it('approaches the continuum gap and correlator quadratically under refinement', () => {
    const coarse = { sites: 8, beta: 8, omega: 1 };
    const fine = { ...coarse, sites: 32 };
    expect(Math.abs(latticeGap(fine) - 1)).toBeLessThan(
      Math.abs(latticeGap(coarse) - 1) / 8,
    );
    const continuum = continuumCorrelator(fine, 2);
    expect(Math.abs(latticeCorrelator(fine, 8) - continuum)).toBeLessThan(
      Math.abs(latticeCorrelator(coarse, 2) - continuum) / 8,
    );
  });

  it('projects full pair aggregates without subtracting individual path means', () => {
    const paths = [
      [1, 2, 3, 4],
      [3, 1, 0, -2],
    ];
    const pairs = Array.from({ length: 4 }, (_, i) =>
      Array.from(
        { length: 4 },
        (_, j) =>
          (paths[0]![i]! * paths[0]![j]! + paths[1]![i]! * paths[1]![j]!) / 2,
      ),
    );
    const direct = pathCorrelator(paths[0]!).map(
      (v, lag) => (v + pathCorrelator(paths[1]!)[lag]!) / 2,
    );
    expect(segmentCorrelator(pairs)).toEqual(direct);
    expect(pathCorrelator([2, 2, 2, 2])).toEqual([4, 4, 4]);
  });
});
