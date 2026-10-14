import { describe, expect, it } from 'vitest';
import { isingGraphPreset } from '../domain/graph';
import type { Domain } from '../domain/graph';
import { pottsDomain, pottsGraph } from '../domain/pottsDomain';
import type { PottsGeometry } from '../domain/pottsDomain';
import {
  pottsAction,
  pottsConditional,
  pottsDifference,
  pottsModel,
  pottsObservables,
  pottsSpatial,
  validatePottsState,
} from './potts';
import { decodePotts } from './pottsExact';

export function graphFixture(
  geometry: PottsGeometry,
  q: 2 | 3 | 4,
  K = 0.7,
  h = 0.2,
) {
  return pottsModel({ q, h, geometry: pottsGraph(geometry, K) });
}
// Independent direct sum uses original graph IDs, not the adapter or local scores.
function graphOracle(
  domain: Domain,
  couplings: Record<string, number>,
  h: number,
  state: Uint8Array,
) {
  const colors = Object.fromEntries(
    domain.vertices.map((v, i) => [v.id, state[i]]),
  );
  return (
    -domain.edges.reduce(
      (s, e) =>
        s + couplings[e.id]! * Number(colors[e.tail] === colors[e.head]),
      0,
    ) -
    h * Array.from(state).filter((c) => c === 0).length
  );
}
describe('Potts geometry and action', () => {
  it('keeps each original torus bond, oriented face and present zero coupling', () => {
    const g = pottsGraph('torus', 0),
      d = pottsDomain(g);
    expect(d.size).toBe(4);
    expect(d.bonds).toHaveLength(8);
    expect(d.graph?.faces).toHaveLength(4);
    expect(d.bonds.map((b) => b.id)).toEqual(
      Array.from({ length: 8 }, (_, i) => `e${i}`),
    );
    expect(d.incident.map((x) => x.length)).toEqual([4, 4, 4, 4]);
    expect(d.graph).toEqual(isingGraphPreset('torus'));
  });
  for (const q of [2, 3, 4] as const)
    for (const geometry of [
      'site',
      'dimer',
      'chain3',
      'triangle',
      'square',
      'torus',
    ] as const)
      it(`q=${q} ${geometry}: every recoloring matches an independent full action`, () => {
        const domain = isingGraphPreset(geometry),
          couplings = Object.fromEntries(
            domain.edges.map((e, i) => [e.id, [0, -0.8, 1.3][i % 3]!]),
          ),
          h = -0.6;
        const model = pottsModel({
          q,
          h,
          geometry: { kind: 'graph', domain, couplings },
        });
        for (let code = 0; code < q ** model.size; code++) {
          const state = decodePotts(code, model.size, q),
            action = graphOracle(domain, couplings, h, state);
          expect(pottsAction(model, state)).toBeCloseTo(action, 12);
          for (let i = 0; i < model.size; i++) {
            const costs = Array.from({ length: q }, (_, c) => {
              const next = state.slice();
              next[i] = c;
              return graphOracle(domain, couplings, h, next);
            });
            const weights = costs.map((s) => Math.exp(-s)),
              sum = weights.reduce((s, w) => s + w, 0);
            const conditional = pottsConditional(model, state, i);
            expect(conditional.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 14);
            for (let c = 0; c < q; c++) {
              expect(pottsDifference(model, state, i, c)).toBeCloseTo(
                costs[c]! - action,
                12,
              );
              expect(conditional[c]).toBeCloseTo(weights[c]! / sum, 13);
            }
          }
        }
      });
  it('self-links add constants without entering local scores; periodic 1×4 retains four records', () => {
    const domain = isingGraphPreset('ring');
    domain.edges.push({ id: 'self', tail: 'v0', head: 'v0' });
    const couplings = Object.fromEntries(
      domain.edges.map((e) => [e.id, e.id === 'self' ? -2 : 0.5]),
    );
    const m = pottsModel({
        q: 3,
        h: 0,
        geometry: { kind: 'graph', domain, couplings },
      }),
      s = Uint8Array.of(0, 1, 2, 0);
    expect(m.bonds).toHaveLength(5);
    expect(m.incident[0]).toHaveLength(2);
    expect(pottsAction(m, s)).toBe(1.5);
    expect(pottsDifference(m, s, 0, 1)).toBe(0);
    const expected = [Math.exp(0.5), Math.exp(0.5), 1].map(
      (w) => w / (2 * Math.exp(0.5) + 1),
    );
    pottsConditional(m, s, 0).forEach((p, c) =>
      expect(p).toBeCloseTo(expected[c]!, 14),
    );
  });
  for (const periodicX of [false, true])
    for (const periodicY of [false, true])
      it(`independent coordinate sum for 2×2 boundaries ${periodicX}/${periodicY}`, () => {
        const q = 4,
          kx = -1.2,
          ky = 0.4,
          h = 0.3;
        const m = pottsModel({
          q,
          h,
          geometry: {
            kind: 'lattice',
            shape: { lx: 2, ly: 2, periodicX, periodicY },
            kx,
            ky,
          },
        });
        expect(m.bonds.filter((b) => b.axis === 0)).toHaveLength(
          periodicX ? 4 : 2,
        );
        expect(m.bonds.filter((b) => b.axis === 1)).toHaveLength(
          periodicY ? 4 : 2,
        );
        function oracle(s: Uint8Array) {
          let a = 0;
          for (let y = 0; y < 2; y++)
            for (let x = 0; x < 2; x++) {
              const i = x + 2 * y;
              a -= h * Number(s[i] === 0);
              if (x === 0 || periodicX)
                a -= kx * Number(s[i] === s[((x + 1) % 2) + 2 * y]);
              if (y === 0 || periodicY)
                a -= ky * Number(s[i] === s[x + 2 * ((y + 1) % 2)]);
            }
          return a;
        }
        for (let code = 0; code < 256; code++) {
          const s = decodePotts(code, 4, q);
          expect(pottsAction(m, s)).toBeCloseTo(oracle(s), 12);
          for (let i = 0; i < 4; i++) {
            const weights = Array.from({ length: q }, (_, c) => {
              const candidate = s.slice();
              candidate[i] = c;
              return Math.exp(-oracle(candidate));
            });
            const total = weights.reduce((a, b) => a + b, 0);
            const conditional = pottsConditional(m, s, i);
            for (let c = 0; c < q; c++) {
              expect(conditional[c]).toBeCloseTo(weights[c]! / total, 13);
              const t = s.slice();
              t[i] = c;
              expect(pottsDifference(m, s, i, c)).toBeCloseTo(
                oracle(t) - oracle(s),
                12,
              );
            }
          }
        }
      });
  it('rejects unsupported parameters, malformed IDs and invalid categorical states', () => {
    const m = graphFixture('dimer', 3);
    for (const state of [[0], [0, 3], [0, -1], [0, 0.5], [0, NaN]])
      expect(() => validatePottsState(m, state)).toThrow();
    for (const q of [0, 1, 5, 2.5])
      expect(() =>
        pottsModel({ q: q as 2, h: 0, geometry: pottsGraph('site') }),
      ).toThrow();
    for (const h of [-4.1, 4.1, NaN, Infinity])
      expect(() =>
        pottsModel({ q: 2, h, geometry: pottsGraph('site') }),
      ).toThrow();
    expect(() =>
      pottsModel({
        q: 3,
        h: 0,
        geometry: {
          kind: 'lattice',
          shape: { lx: 33, ly: 2, periodicX: true, periodicY: true },
          kx: 1,
          ky: 1,
        },
      }),
    ).toThrow();
    expect(() =>
      pottsModel({
        q: 3,
        h: 0,
        geometry: {
          kind: 'lattice',
          shape: { lx: 2, ly: 1, periodicX: false, periodicY: false },
          kx: 1,
          ky: 1,
        },
      }),
    ).toThrow();
    expect(() =>
      pottsModel({
        q: 3,
        h: 0,
        geometry: {
          kind: 'graph',
          domain: isingGraphPreset('dimer'),
          couplings: { wrong: 1 },
        },
      }),
    ).toThrow();
  });
  it('uses categorical fractions and raw equality, never mean label or spatial demeaning', () => {
    const m = pottsModel({
      q: 3,
      h: 1,
      geometry: {
        kind: 'lattice',
        shape: { lx: 3, ly: 2, periodicX: false, periodicY: true },
        kx: 0.5,
        ky: 0,
      },
    });
    const state = Uint8Array.of(0, 1, 2, 0, 1, 2),
      v = pottsObservables(m, state);
    expect(v.p0).toBeCloseTo(1 / 3);
    expect(v.m0).toBe(0);
    expect(v.majority).toBe(0);
    expect(pottsSpatial(m, state, 0)).toEqual([
      { r: 0, pairs: 6, same: 1 },
      { r: 1, pairs: 4, same: 0 },
      { r: 2, pairs: 2, same: 0 },
    ]);
    expect(pottsSpatial(m, state, 1)).toEqual([
      { r: 0, pairs: 6, same: 1 },
      { r: 1, pairs: 6, same: 1 },
    ]);
    const renamed = Uint8Array.from(state, (c) => (c + 1) % 3);
    expect(pottsSpatial(m, renamed, 0)).toEqual(pottsSpatial(m, state, 0));
    expect(pottsObservables(graphFixture('dimer', 2), [0, 1]).majority).toBe(0);
    expect(pottsObservables(graphFixture('dimer', 3), [0, 1]).majority).toBe(
      0.25,
    );
  });
});
