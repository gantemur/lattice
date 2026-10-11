import { describe, expect, it } from 'vitest';
import { latticeGap } from './oscillatorReference';
import {
  assessTransferQuadrature,
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
  it('discloses fixed-grid quality against the exact finite-spacing gap', () => {
    const usual = assessTransferQuadrature(p, transferQuadrature(p));
    expect(usual.status).toBe('usable');
    expect(usual.relativeGapDiscrepancy).toBeLessThan(0.05);

    const narrow = { sites: 64, beta: 2, omega: 0.25 };
    const grid = transferQuadrature(narrow);
    const quality = assessTransferQuadrature(narrow, grid);
    expect(grid.first).toBeCloseTo(1.1673, 3);
    expect(grid.gap).toBeCloseTo(0.131145, 3);
    expect(quality.exactGap).toBeCloseTo(0.25, 4);
    expect(quality.exactLeadingEigenvalue).toBeCloseTo(0.9961, 4);
    expect(quality.gridSpacing).toBeCloseTo(0.5, 12);
    expect(quality.kineticWidth).toBeCloseTo(Math.sqrt(1 / 32), 12);
    expect(quality.relativeGapDiscrepancy).toBeGreaterThan(0.45);
    expect(quality.status).toBe('under-resolved');
    expect(quality.reasons).toHaveLength(2);
  });
  it('never certifies missing or unusable eigenvalue data', () => {
    const grid = transferQuadrature(p);
    expect(assessTransferQuadrature(p, null).status).toBe('unavailable');
    expect(assessTransferQuadrature(p, { ...grid, second: NaN }).status).toBe(
      'unavailable',
    );
    expect(
      assessTransferQuadrature(p, { ...grid, gap: grid.gap! * 2 }).status,
    ).toBe('unavailable');
  });
  it('finds positive-semidefinite reflection Gram matrices (allowing zeros)', () => {
    for (const sites of [4, 8, 16, 32]) {
      const example = reflectionExample({ ...p, sites });
      expect(example.eigenvalues.at(-1)!).toBeGreaterThan(-example.tolerance);
    }
  });
});
