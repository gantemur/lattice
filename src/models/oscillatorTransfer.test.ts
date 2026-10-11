import { describe, expect, it } from 'vitest';
import { latticeGap } from './oscillatorReference';
import {
  reflectionExample,
  symmetricEigenvalues,
  transferKernel,
  transferLevels,
  transferQuadrature,
} from './oscillatorTransfer';

describe('symmetric transfer demonstration', () => {
  const p = { sites: 16, beta: 8, omega: 1 };
  it('has symmetric kernel and analytically spaced leading levels', () => {
    expect(transferKernel(p, -1, 2)).toBeCloseTo(transferKernel(p, 2, -1), 14);
    const levels = transferLevels(p);
    expect(levels.first - levels.ground).toBeCloseTo(latticeGap(p), 14);
    expect(
      -Math.log(levels.leadingEigenvalues[1]! / levels.leadingEigenvalues[0]!) /
        (p.beta / p.sites),
    ).toBeCloseTo(latticeGap(p), 14);
  });
  it('computes eigenvalues of a hand-checkable matrix', () => {
    expect(
      symmetricEigenvalues([
        [2, 1],
        [1, 2],
      ]),
    ).toEqual([3, 1]);
  });
  it('shows positive quadrature spectrum and grid convergence', () => {
    const coarse = transferQuadrature(p, 33);
    const fine = transferQuadrature(p, 65);
    expect(fine.first).toBeGreaterThan(fine.second);
    expect(fine.second).toBeGreaterThan(0);
    expect(Math.abs(fine.gap! - latticeGap(p))).toBeLessThan(
      Math.abs(coarse.gap! - latticeGap(p)),
    );
    expect(fine.gap).toBeCloseTo(latticeGap(p), 3);
  });
  it('finds positive-semidefinite reflection Gram matrices (allowing zeros)', () => {
    for (const sites of [4, 8, 16, 32]) {
      const example = reflectionExample({ ...p, sites });
      expect(example.eigenvalues.at(-1)!).toBeGreaterThan(-example.tolerance);
    }
  });
});
