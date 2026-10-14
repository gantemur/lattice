import type { Face } from '../domain/graph';
import { describe, expect, it } from 'vitest';
import { pottsGraph } from '../domain/pottsDomain';
import { pottsModel } from './potts';
import {
  exactPotts,
  pottsDimerReference,
  pottsTriangleReference,
} from './pottsExact';
import {
  decodeFK,
  fkComponents,
  fkProbabilities,
  fkIneligibility,
  edwardsSokalLogWeight,
} from './fk';
import { exactFK } from './fkExact';
import { bfsComponents, independentJoint } from '../test/fkOracle';

describe('FK finite measure and Edwards–Sokal identities', () => {
  for (const q of [2, 3, 4] as const)
    for (const geometry of [
      'site',
      'dimer',
      'chain3',
      'triangle',
      'square',
      'torus',
    ] as const)
      for (const K of [0, 0.7, 4])
        it(`${q} ${geometry} K=${K}: absolute weights, physical bonds and connectivity`, () => {
          const model = pottsModel({
              q,
              h: 0,
              geometry: pottsGraph(geometry, K),
            }),
            fk = exactFK(model),
            spin = exactPotts(model);
          expect(fk.logPottsPartition).toBeCloseTo(spin.logPartition, 11);
          const expanded = fk.states.reduce((sum, flags) => {
            const c = bfsComponents(model, flags);
            let weight = q ** c.count;
            model.bonds.forEach((b, e) => {
              if (flags[e]) weight *= Math.expm1(b.K);
            });
            return sum + weight;
          }, 0);
          expect(Math.log(expanded)).toBeCloseTo(spin.logPartition, 11);
          fk.states.forEach((flags, code) => {
            const oracle = bfsComponents(model, flags);
            expect(Array.from(fk.components[code]!.labels)).toEqual(
              oracle.labels,
            );
            expect(fk.components[code]!.sizes).toEqual(oracle.sizes);
            let jointSum = 0;
            spin.states.forEach((state) => {
              jointSum += independentJoint(model, state, flags);
            });
            expect(fk.weights[code]).toBeCloseTo(jointSum, 10);
          });
          for (let i = 0; i < model.size; i++)
            for (let j = 0; j < model.size; j++)
              expect(spin.pairs[i]![j]).toBeCloseTo(
                1 / q + (1 - 1 / q) * fk.connectivity[i]![j]!,
                11,
              );
          fkProbabilities(model).forEach((p, e) =>
            expect(fk.bonds[e]).toBeCloseTo(p * spin.bonds[e]!, 11),
          );
          if (K === 0) {
            expect(fk.probabilities[0]).toBe(1);
            expect(fk.logPartition).toBeCloseTo(model.size * Math.log(q));
          }
          if (geometry === 'dimer')
            expect(fk.logPottsPartition).toBeCloseTo(
              pottsDimerReference(q, K).logPartition,
              12,
            );
          if (geometry === 'triangle')
            expect(fk.logPottsPartition).toBeCloseTo(
              pottsTriangleReference(q, K).logPartition,
              12,
            );
        });
  it('hand-checkable q=3 dimer at K=log2', () => {
    const model = pottsModel({
        q: 3,
        h: 0,
        geometry: pottsGraph('dimer', Math.log(2)),
      }),
      fk = exactFK(model);
    expect(Math.exp(fk.logPartition)).toBeCloseTo(6, 13);
    expect(Math.exp(fk.logPottsPartition)).toBeCloseTo(12, 13);
    expect(fk.probabilities[0]).toBeCloseTo(0.75, 14);
    expect(fk.probabilities[1]).toBeCloseTo(0.25, 14);
    expect(fk.connectivity[0]![1]).toBe(0.25);
    expect(exactPotts(model).pairs[0]![1]).toBeCloseTo(0.5, 14);
  });
  it('nonuniform, zero, parallel and self bonds keep all records and both joint marginals', () => {
    const geometry = pottsGraph('torus');
    if (geometry.kind !== 'graph') throw Error();
    geometry.domain.edges.push({ id: 'self', tail: 'v0', head: 'v0' });
    geometry.couplings.self = 0.2;
    geometry.domain.faces = [];
    geometry.domain.edges = geometry.domain.edges
      .slice(0, 5)
      .concat(geometry.domain.edges.at(-1)!);
    geometry.couplings = Object.fromEntries(
      geometry.domain.edges.map((b, i) => [b.id, i === 0 ? 0 : i / 3]),
    );
    const model = pottsModel({ q: 3, h: 0, geometry }),
      fk = exactFK(model),
      spin = exactPotts(model);
    expect(fk.states).toHaveLength(64);
    expect(fk.bonds[0]).toBe(0);
    spin.states.forEach((state, i) => {
      const weight = fk.states.reduce(
        (sum, flags) => sum + independentJoint(model, state, flags),
        0,
      );
      expect(weight / Math.exp(fk.logPartition)).toBeCloseTo(
        spin.probabilities[i]!,
        12,
      );
      fk.states.forEach((flags) =>
        expect(
          Math.exp(edwardsSokalLogWeight(model, state, flags)),
        ).toBeCloseTo(independentJoint(model, state, flags), 13),
      );
    });
    fk.states.forEach((flags) =>
      expect(
        Array.from(fkComponents(model.size, model.bonds, flags).labels),
      ).toEqual(bfsComponents(model, flags).labels),
    );
  });
  for (const periodicX of [false, true])
    for (const periodicY of [false, true])
      it(`anisotropic rectangle ${periodicX}/${periodicY}`, () => {
        const model = pottsModel({
          q: 4,
          h: 0,
          geometry: {
            kind: 'lattice',
            shape: { lx: 2, ly: 2, periodicX, periodicY },
            kx: 0,
            ky: 1.4,
          },
        });
        expect(exactFK(model).logPottsPartition).toBeCloseTo(
          exactPotts(model).logPartition,
          12,
        );
      });
  it('rejects ineligible physics and independent reference caps', () => {
    expect(
      fkIneligibility(
        pottsModel({ q: 3, h: 1, geometry: pottsGraph('dimer') }),
      ),
    ).toContain('h=0');
    expect(() =>
      exactFK(pottsModel({ q: 3, h: 0, geometry: pottsGraph('triangle', -1) })),
    ).toThrow('K≥0');
    const model = pottsModel({
      q: 2,
      h: 0,
      geometry: {
        kind: 'lattice',
        shape: { lx: 2, ly: 3, periodicX: false, periodicY: false },
        kx: 1,
        ky: 1,
      },
    });
    expect(() => exactFK(model)).toThrow('V≤4');
    expect(() =>
      fkComponents(2, [{ tail: 0, head: 1 }], decodeFK(0, 0)),
    ).toThrow('flag');
  });
});

// Compare directly with BOTH established Ising references, rather than relying
// on transitivity through the new Potts/FK identity alone.
import { exactIsing } from './ising';
import { exactLatticeTwoByTwo } from './latticeExact';
for (const geometry of ['dimer', 'triangle', 'square', 'torus'] as const)
  it(`q2 FK absolute Ising normalization and connectivity: ${geometry}`, () => {
    const g = pottsGraph(geometry, 0.8);
    if (g.kind !== 'graph') throw Error();
    const model = pottsModel({ q: 2, h: 0, geometry: g }),
      fk = exactFK(model);
    const ising = exactIsing({
      kind: 'ising',
      parameters: {
        domain: g.domain,
        couplings: Object.fromEntries(
          Object.entries(g.couplings).map(([id, K]) => [id, K / 2]),
        ),
        fields: Object.fromEntries(g.domain.vertices.map((v) => [v.id, 0])),
      },
    });
    const sumK = model.bonds.reduce((sum, b) => sum + b.K, 0);
    expect(fk.logPartition + sumK / 2).toBeCloseTo(ising.logPartition, 12);
    fk.connectivity.forEach((row, i) =>
      row.forEach((p, j) =>
        expect(p).toBeCloseTo(ising.correlations[i]![j]!, 12),
      ),
    );
  });
for (const periodicX of [false, true])
  for (const periodicY of [false, true])
    it(`q2 FK indexed Ising absolute normalization ${periodicX}/${periodicY}`, () => {
      const shape = { lx: 2, ly: 2, periodicX, periodicY },
        kx = 0.4,
        ky: number = 1.2;
      const fk = exactFK(
        pottsModel({
          q: 2,
          h: 0,
          geometry: { kind: 'lattice', shape, kx, ky },
        }),
      );
      const ising = exactLatticeTwoByTwo({
        ...shape,
        jx: kx / 2,
        jy: ky / 2,
        field: 0,
        temperature: 1,
      });
      const sumK = (periodicX ? 4 : 2) * kx + (periodicY ? 4 : 2) * ky;
      expect(fk.logPartition + sumK / 2).toBeCloseTo(ising.logPartition, 12);
    });

it('q4 torus: both full joint marginals and both conditional laws, all 65,536 pairs', () => {
  const model = pottsModel({ q: 4, h: 0, geometry: pottsGraph('torus', 0.7) }),
    spin = exactPotts(model),
    fk = exactFK(model);
  spin.states.forEach((state, i) => {
    let spinWeight = 0;
    fk.states.forEach((flags, a) => {
      const joint = independentJoint(model, state, flags);
      spinWeight += joint;
      let conditional = 1;
      model.bonds.forEach((b, e) => {
        const p = state[b.tail] === state[b.head] ? 1 - Math.exp(-b.K) : 0;
        conditional *= flags[e] ? p : 1 - p;
      });
      expect(
        joint / (spin.probabilities[i]! * Math.exp(fk.logPartition)),
      ).toBeCloseTo(conditional, 12);
      const c = bfsComponents(model, flags);
      const compatible = model.bonds.every(
        (b, e) => !flags[e] || state[b.tail] === state[b.head],
      );
      expect(joint / fk.weights[a]!).toBeCloseTo(
        compatible ? model.q ** -c.count : 0,
        12,
      );
    });
    expect(spinWeight / Math.exp(fk.logPartition)).toBeCloseTo(
      spin.probabilities[i]!,
      12,
    );
  });
});

it('periodic 1×4 cell complex keeps four self-links and four cycle bonds', () => {
  // Positive x records are self-links; positive y records form the four-cycle.
  // The four oriented face walks remain valid despite repeated endpoints.
  const vertices = Array.from({ length: 4 }, (_, y) => ({ id: `v${y}` }));
  const edges = vertices.flatMap((v, y) => [
    { id: `x${y}`, tail: v.id, head: v.id },
    { id: `y${y}`, tail: v.id, head: `v${(y + 1) % 4}` },
  ]);
  const faces: Face[] = vertices.map((_, y) => ({
    id: `f${y}`,
    boundary: [
      { edgeId: `x${y}`, sign: 1 },
      { edgeId: `y${y}`, sign: 1 },
      { edgeId: `x${(y + 1) % 4}`, sign: -1 },
      { edgeId: `y${y}`, sign: -1 },
    ],
  }));
  const domain = {
    id: 'test-1x4',
    name: 'Test periodic 1×4',
    vertices,
    edges,
    faces,
  };
  const model = pottsModel({
    q: 3,
    h: 0,
    geometry: {
      kind: 'graph',
      domain,
      couplings: Object.fromEntries(edges.map((e) => [e.id, 0.7])),
    },
  });
  const fk = exactFK(model);
  expect(fk.states).toHaveLength(256);
  expect(fk.logPottsPartition).toBeCloseTo(exactPotts(model).logPartition, 12);
  for (let y = 0; y < 4; y++)
    expect(fk.bonds[2 * y]).toBeCloseTo(1 - Math.exp(-0.7), 12);
  fk.states.forEach((flags) =>
    expect(Array.from(fkComponents(4, model.bonds, flags).labels)).toEqual(
      bfsComponents(model, flags).labels,
    ),
  );
});
