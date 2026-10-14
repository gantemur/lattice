import { expect, it } from 'vitest';
import { isingGraphPreset } from '../domain/graph';
import { pottsGraph } from '../domain/pottsDomain';
import { exactIsing, isingAction, conditionalPlus } from './ising';
import type { IsingModel } from './ising';
import { exactLatticeTwoByTwo } from './latticeExact';
import { pottsModel, pottsAction, pottsConditional } from './potts';
import {
  exactPotts,
  pottsStateCount,
  pottsSiteReference,
  pottsDimerReference,
  pottsTriangleReference,
} from './pottsExact';

for (const q of [2, 3, 4] as const)
  for (const K of [-4, -0.7, 0, 0.7, 4])
    it(`q=${q},K=${K}: independent site/dimer/triangle counting`, () => {
      const site = exactPotts(
        pottsModel({ q, h: K, geometry: pottsGraph('site') }),
      );
      expect(site.logPartition).toBeCloseTo(Math.log(Math.exp(K) + q - 1), 12);
      expect(site.siteProbabilities[0]![0]).toBeCloseTo(
        Math.exp(K) / (Math.exp(K) + q - 1),
        13,
      );
      expect(pottsSiteReference(q, K).logPartition).toBeCloseTo(
        site.logPartition,
        13,
      );
      for (const g of ['dimer', 'triangle'] as const) {
        const model = pottsModel({ q, h: 0, geometry: pottsGraph(g, K) }),
          e = exactPotts(model);
        const Z =
          g === 'dimer'
            ? q * (Math.exp(K) + q - 1)
            : q * Math.exp(3 * K) +
              3 * q * (q - 1) * Math.exp(K) +
              q * (q - 1) * (q - 2);
        expect(e.probabilities).toHaveLength(q ** model.size);
        expect(e.logPartition).toBeCloseTo(Math.log(Z), 12);
        expect(e.means.m0).toBeCloseTo(0, 13);
        expect(e.means.majority).toBeGreaterThan(0);
        const analytical =
          g === 'dimer'
            ? pottsDimerReference(q, K)
            : pottsTriangleReference(q, K);
        expect(e.means.agreement).toBeCloseTo(analytical.agreement, 12);
        if (g === 'triangle' && K < 0) {
          const minimum = Math.min(...e.actions),
            ground = e.actions.filter((s) => Math.abs(s - minimum) < 1e-12);
          expect(ground).toHaveLength(q === 2 ? 6 : q === 3 ? 6 : 24);
          expect(minimum).toBeCloseTo(q === 2 ? -K : 0, 12);
        }
      }
      const independent = exactPotts(
        pottsModel({ q, h: K, geometry: pottsGraph('square', 0) }),
      );
      expect(independent.logPartition).toBeCloseTo(
        4 * Math.log(Math.exp(K) + q - 1),
        12,
      );
      const p0 = Math.exp(K) / (Math.exp(K) + q - 1),
        other = 1 / (Math.exp(K) + q - 1);
      expect(independent.pairs[0]![3]).toBeCloseTo(
        p0 * p0 + (q - 1) * other * other,
        12,
      );
    });
for (const geometry of ['dimer', 'triangle', 'square', 'torus'] as const)
  for (const self of [false, true])
    it(`q=2 absolute Ising correspondence ${geometry}, self=${self}`, () => {
      const domain = isingGraphPreset(geometry);
      if (self) domain.edges.push({ id: 'self', tail: 'v0', head: 'v0' });
      const couplings = Object.fromEntries(
          domain.edges.map((e, i) => [e.id, [-1.4, 0.8, 0, 2.2][i % 4]!]),
        ),
        h = 0.6;
      const potts = pottsModel({
        q: 2,
        h,
        geometry: { kind: 'graph', domain, couplings },
      });
      const ising: IsingModel = {
        kind: 'ising',
        parameters: {
          domain,
          couplings: Object.fromEntries(
            Object.entries(couplings).map(([id, K]) => [id, K / 2]),
          ),
          fields: Object.fromEntries(domain.vertices.map((v) => [v.id, h / 2])),
        },
      };
      const a = exactPotts(potts),
        b = exactIsing(ising),
        shift =
          (Object.values(couplings).reduce((s, K) => s + K, 0) +
            domain.vertices.length * h) /
          2;
      expect(a.logPartition).toBeCloseTo(b.logPartition + shift, 12);
      let meanM = 0,
        meanAbs = 0;
      a.states.forEach((state, code) => {
        const bits = Array.from(state).reduce(
            (s, c, i) => s + (c === 0 ? 1 << i : 0),
            0,
          ),
          m =
            Array.from(state).reduce((s, c) => s + (c === 0 ? 1 : -1), 0) /
            state.length;
        expect(pottsAction(potts, state)).toBeCloseTo(
          isingAction(ising, bits) - shift,
          12,
        );
        expect(a.probabilities[code]).toBeCloseTo(b.probabilities[bits]!, 13);
        meanM += b.probabilities[bits]! * m;
        meanAbs += b.probabilities[bits]! * Math.abs(m);
        for (let i = 0; i < state.length; i++)
          expect(pottsConditional(potts, state, i)[0]).toBeCloseTo(
            conditionalPlus(ising, bits, i),
            13,
          );
      });
      expect(a.means.m0).toBeCloseTo(meanM, 13);
      expect(a.means.majority).toBeCloseTo(meanAbs, 13);
      for (let i = 0; i < potts.size; i++) {
        expect(2 * a.siteProbabilities[i]![0]! - 1).toBeCloseTo(
          b.means[i]!,
          12,
        );
        for (let j = 0; j < potts.size; j++)
          expect(2 * a.pairs[i]![j]! - 1).toBeCloseTo(
            b.correlations[i]![j]!,
            12,
          );
      }
      potts.bonds.forEach((bond, i) =>
        expect(a.bonds[i]).toBeCloseTo(
          (1 + b.correlations[bond.tail]![bond.head]!) / 2,
          12,
        ),
      );
    });
for (const periodicX of [false, true])
  for (const periodicY of [false, true])
    it(`2×2 indexed Ising constant and probabilities ${periodicX}/${periodicY}`, () => {
      const shape = { lx: 2, ly: 2, periodicX, periodicY },
        kx = -1.2,
        ky = 0.8,
        h = -0.4;
      const model = pottsModel({
          q: 2,
          h,
          geometry: { kind: 'lattice', shape, kx, ky },
        }),
        a = exactPotts(model);
      const b = exactLatticeTwoByTwo({
        ...shape,
        jx: kx / 2,
        jy: ky / 2,
        field: h / 2,
        temperature: 1,
      });
      const shift =
        ((periodicX ? 4 : 2) * kx + (periodicY ? 4 : 2) * ky + 4 * h) / 2;
      expect(a.logPartition).toBeCloseTo(b.logPartition + shift, 12);
      a.probabilities.forEach((p, code) =>
        expect(p).toBeCloseTo(b.probabilities[15 - code]!, 13),
      );
      expect(a.means.m0).toBeCloseTo(b.meanM, 13);
      expect(a.means.majority).toBeCloseTo(b.meanAbsM, 13);
      expect(a.means.action).toBeCloseTo(4 * b.meanE - shift, 12);
      expect(a.means.agreementX).toBeCloseTo((1 + b.meanGx) / 2, 12);
      expect(a.means.agreementY).toBeCloseTo((1 + b.meanGy) / 2, 12);
    });
it('gates exponential work and remains finite for concentrated signed measures', () => {
  const large = pottsModel({
    q: 4,
    h: 4,
    geometry: {
      kind: 'lattice',
      shape: { lx: 32, ly: 32, periodicX: true, periodicY: true },
      kx: 4,
      ky: -4,
    },
  });
  expect(pottsStateCount(large)).toBeNull();
  expect(() => exactPotts(large)).toThrow();
  const tiny = exactPotts(
    pottsModel({ q: 4, h: 4, geometry: pottsGraph('torus', 4) }),
  );
  expect(tiny.logPartition).toBeGreaterThanOrEqual(48);
  expect(tiny.probabilities.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 14);
  expect(tiny.probabilities.every((p) => p >= 0 && Number.isFinite(p))).toBe(
    true,
  );
});
