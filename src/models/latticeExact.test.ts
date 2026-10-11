import { describe, expect, it } from 'vitest';
import { graphPreset } from '../domain/graph';
import { exactIsing } from './ising';
import type { IsingModel } from './ising';
import { exactLatticeTwoByTwo } from './latticeExact';
import type { LatticeParameters } from './latticeIsing';

const base: LatticeParameters = {
  lx: 2,
  ly: 2,
  periodicX: true,
  periodicY: true,
  jx: 1,
  jy: 1,
  field: 0,
  temperature: 2,
};

describe('2×2 physical-parameter exact reference', () => {
  it.each([
    [false, false, 4],
    [true, false, 6],
    [false, true, 6],
    [true, true, 8],
  ] as const)(
    'includes %s/%s boundary bonds',
    (periodicX, periodicY, bonds) => {
      const result = exactLatticeTwoByTwo({ ...base, periodicX, periodicY });
      expect(result.bondCount).toBe(bonds);
      expect(result.probabilities).toHaveLength(16);
      expect(result.probabilities.reduce((sum, p) => sum + p, 0)).toBeCloseTo(
        1,
        14,
      );
    },
  );

  it('remains finite for strongly concentrated ferromagnetic and antiferromagnetic measures', () => {
    for (const sign of [-1, 1]) {
      const result = exactLatticeTwoByTwo({
        ...base,
        jx: sign * 10,
        jy: sign * 10,
        temperature: 0.05,
      });
      expect(result.logPartition).toBeCloseTo(1600 + Math.log(2), 10);
      expect(result.meanM).toBe(0);
      expect(result.meanAbsM).toBe(sign === 1 ? 1 : 0);
      expect(result.secondM).toBe(sign === 1 ? 1 : 0);
      expect(result.meanE).toBe(-20);
      expect(result.secondE).toBe(400);
      expect(result.probabilities.reduce((sum, p) => sum + p, 0)).toBe(1);
    }
  });

  it('handles maximal field and all supported parameter corners', () => {
    const fieldOnly = exactLatticeTwoByTwo({
      ...base,
      jx: 0,
      jy: 0,
      field: 10,
      temperature: 0.05,
    });
    expect(fieldOnly.logPartition).toBeCloseTo(800, 12);
    expect(fieldOnly.meanM).toBe(1);
    expect(fieldOnly.meanE).toBe(-10);
    expect(fieldOnly.secondE).toBe(100);
    expect(fieldOnly.magnetizationDistribution.at(-1)).toEqual([1, 1]);
    for (const periodicX of [false, true])
      for (const periodicY of [false, true])
        for (const jx of [-10, 10])
          for (const jy of [-10, 10])
            for (const field of [-10, 10]) {
              const result = exactLatticeTwoByTwo({
                ...base,
                periodicX,
                periodicY,
                jx,
                jy,
                field,
                temperature: 0.05,
              });
              expect(Number.isFinite(result.logPartition)).toBe(true);
              expect(Number.isFinite(result.meanE)).toBe(true);
              expect(Number.isFinite(result.secondE)).toBe(true);
              expect(result.probabilities.every((p) => p >= 0 && p <= 1)).toBe(
                true,
              );
              expect(
                result.probabilities.reduce((sum, p) => sum + p, 0),
              ).toBeCloseTo(1, 14);
            }
  });

  it('preserves zero-field spin-reversal symmetry at low temperature', () => {
    const result = exactLatticeTwoByTwo({
      ...base,
      jx: -7,
      jy: 9,
      temperature: 0.05,
    });
    expect(result.meanM).toBe(0);
    for (let code = 0; code < 8; code++)
      expect(result.probabilities[code]).toBe(result.probabilities[code ^ 15]);
    for (const [m, probability] of result.magnetizationDistribution)
      expect(probability).toBe(
        result.magnetizationDistribution.find(([other]) => other === -m)![1],
      );
  });

  it.each([false, true])(
    'agrees with M1a when periodic=%s and dimensionless inputs are supported',
    (periodic) => {
      const p = {
        ...base,
        periodicX: periodic,
        periodicY: periodic,
        jx: -0.7,
        jy: 1.3,
        field: 0.2,
        temperature: 2.4,
      };
      const domain = graphPreset(periodic ? 'torus' : 'square');
      const model: IsingModel = {
        kind: 'ising',
        parameters: {
          domain,
          couplings: Object.fromEntries(
            domain.edges.map((e) => [
              e.id,
              (e.axis === 0 ? p.jx : p.jy) / p.temperature,
            ]),
          ),
          fields: Object.fromEntries(
            domain.vertices.map((v) => [v.id, p.field / p.temperature]),
          ),
        },
      };
      const m1a = exactIsing(model);
      const m2 = exactLatticeTwoByTwo(p);
      expect(m2.logPartition).toBeCloseTo(m1a.logPartition, 12);
      m2.probabilities.forEach((probability, code) =>
        expect(probability).toBeCloseTo(m1a.probabilities[code]!, 12),
      );
    },
  );
});
