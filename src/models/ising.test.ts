import { describe, expect, it } from 'vitest';
import {
  graphPreset,
  presetNames,
  topologyKey,
  validateDomain,
} from '../domain/graph';
import type { GraphPreset } from '../domain/graph';
import {
  conditionalPlus,
  exactIsing,
  flipDifference,
  isingAction,
  isingPreset,
  isingReference,
  observableValue,
  spinAt,
  validateIsing,
} from './ising';
import { createRng } from '../algorithms/rng';
import { isingTransition } from '../algorithms/isingTransition';
const presets = Object.keys(presetNames) as GraphPreset[];
const counts = [
  [1, 0, 0],
  [4, 3, 0],
  [4, 4, 0],
  [4, 4, 1],
  [4, 3, 0],
  [4, 6, 0],
  [4, 8, 4],
];
it.each(presets)('validates %s counts, incidence and orientation', (kind) => {
  const d = graphPreset(kind),
    [v, e, f] = counts[presets.indexOf(kind)]!;
  expect([d.vertices.length, d.edges.length, d.faces.length]).toEqual([
    v,
    e,
    f,
  ]);
  validateDomain(d);
  for (const face of d.faces) {
    const boundary = Object.fromEntries(d.vertices.map((v) => [v.id, 0]));
    for (const b of face.boundary) {
      const edge = d.edges.find((e) => e.id === b.edgeId)!;
      boundary[edge.tail]! -= b.sign;
      boundary[edge.head]! += b.sign;
    }
    expect(Object.values(boundary)).toEqual(Array(v).fill(0));
  }
  if (kind === 'torus') {
    expect(d.edges.filter((e) => e.wraps)).toHaveLength(4);
    const uses = d.edges.map((e) =>
      d.faces
        .flatMap((f) => f.boundary)
        .filter((b) => b.edgeId === e.id)
        .map((b) => b.sign)
        .sort(),
    );
    expect(uses).toEqual(Array.from({ length: 8 }, () => [-1, 1]));
  }
});
it('rejects malformed incidence and preserves parallel/self records', () => {
  const d = graphPreset('torus');
  d.faces[0]!.boundary[0]!.sign = -1;
  expect(() => validateDomain(d)).toThrow();
  const m = isingPreset('site');
  m.parameters.domain.edges = [{ id: 'loop', tail: 'v0', head: 'v0' }];
  m.parameters.couplings.loop = -2;
  validateIsing(m);
  expect(isingAction(m, 0)).toBe(2);
  expect(flipDifference(m, 0, 0)).toBeCloseTo(0, 14);
  expect(topologyKey(graphPreset('square'))).not.toBe(
    topologyKey(graphPreset('ring')),
  );
});
// Independent Cartesian product, spin vectors and full dot-product oracle.
function configurations(n: number): number[][] {
  return Array.from({ length: 2 ** n }, (_, k) =>
    Array.from({ length: n }, (_, i) =>
      Math.floor(k / 2 ** i) % 2 === 1 ? 1 : -1,
    ),
  );
}
it.each(presets)(
  'enumerates every %s state and checks every local difference and conditional',
  (kind) => {
    const model = isingPreset(kind),
      rng = createRng(912),
      { domain, fields, couplings } = model.parameters;
    for (const e of domain.edges) couplings[e.id] = 3 * rng.uniform() - 1.5;
    for (const v of domain.vertices) fields[v.id] = 2 * rng.uniform() - 1;
    const states = configurations(domain.vertices.length),
      energies = states.map(
        (s) =>
          -domain.edges.reduce(
            (a, e) =>
              a +
              couplings[e.id]! *
                s[Number(e.tail.slice(1))]! *
                s[Number(e.head.slice(1))]!,
            0,
          ) - s.reduce((a, v, i) => a + v * fields[`v${i}`]!, 0),
      );
    const Z = energies.reduce((a, e) => a + Math.exp(-e), 0),
      exact = exactIsing(model);
    expect(exact.logPartition).toBeCloseTo(Math.log(Z), 12);
    for (let k = 0; k < states.length; k++) {
      expect(exact.probabilities[k]).toBeCloseTo(
        Math.exp(-energies[k]!) / Z,
        13,
      );
      expect(isingAction(model, k)).toBeCloseTo(energies[k]!, 12);
      for (let i = 0; i < domain.vertices.length; i++) {
        expect(flipDifference(model, k, i)).toBeCloseTo(
          energies[k ^ (1 << i)]! - energies[k]!,
          12,
        );
        const plus = k | (1 << i),
          minus = k & ~(1 << i);
        expect(conditionalPlus(model, k, i)).toBeCloseTo(
          Math.exp(-energies[plus]!) /
            (Math.exp(-energies[plus]!) + Math.exp(-energies[minus]!)),
          12,
        );
      }
    }
    exact.means.forEach((mean, i) =>
      expect(mean).toBeCloseTo(
        states.reduce(
          (s, v, k) => s + (v[i]! * Math.exp(-energies[k]!)) / Z,
          0,
        ),
        12,
      ),
    );
    exact.correlations.forEach((row, i) =>
      row.forEach((c, j) =>
        expect(c).toBeCloseTo(
          states.reduce(
            (s, v, k) => s + (v[i]! * v[j]! * Math.exp(-energies[k]!)) / Z,
            0,
          ),
          12,
        ),
      ),
    );
  },
);
it('covers arbitrary 2/3-spin graphs, negative parallel bonds and self constants', () => {
  for (const n of [2, 3]) {
    const m = isingPreset('complete');
    m.parameters.domain.vertices = m.parameters.domain.vertices.slice(0, n);
    m.parameters.domain.edges = m.parameters.domain.edges.filter(
      (e) => Number(e.tail.slice(1)) < n && Number(e.head.slice(1)) < n,
    );
    m.parameters.domain.edges.push(
      { id: 'parallel', tail: 'v0', head: 'v1' },
      { id: 'loop', tail: 'v0', head: 'v0' },
    );
    m.parameters.couplings.parallel = -1.2;
    m.parameters.couplings.loop = 3;
    for (let state = 0; state < 2 ** n; state++)
      for (let i = 0; i < n; i++)
        expect(flipDifference(m, state, i)).toBeCloseTo(
          isingAction(m, state ^ (1 << i)) - isingAction(m, state),
          12,
        );
    expect(exactIsing(m).probabilities.reduce((s, p) => s + p, 0)).toBeCloseTo(
      1,
      14,
    );
  }
});
it.each([
  [0, 0],
  [0.7, 0.3],
  [-0.8, -0.4],
  [3, 2],
])('matches Tr(T^4) at K=%s b=%s', (K, b) => {
  const m = isingPreset('ring');
  Object.keys(m.parameters.couplings).forEach(
    (k) => (m.parameters.couplings[k] = K),
  );
  Object.keys(m.parameters.fields).forEach((k) => (m.parameters.fields[k] = b));
  const T = [
    [-1, 1].map((t) => Math.exp(K * -1 * t + (b * (-1 + t)) / 2)),
    [-1, 1].map((t) => Math.exp(K * t + (b * (1 + t)) / 2)),
  ];
  const multiply = (a: number[][], c: number[][]) =>
    a.map((row) =>
      [0, 1].map((j) => row.reduce((s, v, k) => s + v * c[k]![j]!, 0)),
    );
  const T2 = multiply(T, T),
    T4 = multiply(T2, T2);
  expect(exactIsing(m).logPartition).toBeCloseTo(
    Math.log(T4[0]![0]! + T4[1]![1]!),
    12,
  );
});
it('matches an independently listed eight-bond torus, not an open square', () => {
  const m = isingPreset('torus'),
    bonds = [
      [0, 1],
      [1, 0],
      [2, 3],
      [3, 2],
      [0, 2],
      [2, 0],
      [1, 3],
      [3, 1],
    ];
  const Z = configurations(4).reduce(
    (z, s) =>
      z + Math.exp(0.5 * bonds.reduce((e, [i, j]) => e + s[i!]! * s[j!]!, 0)),
    0,
  );
  expect(exactIsing(m).logPartition).toBeCloseTo(Math.log(Z), 13);
  expect(exactIsing(m).logPartition).not.toBeCloseTo(
    exactIsing(isingPreset('square')).logPartition,
    3,
  );
});
it('normalizes strong finite fields/couplings with log-sum-exp', () => {
  const m = isingPreset('torus');
  Object.keys(m.parameters.couplings).forEach(
    (k) => (m.parameters.couplings[k] = 10),
  );
  Object.keys(m.parameters.fields).forEach(
    (k) => (m.parameters.fields[k] = -10),
  );
  expect(Number.isFinite(exactIsing(m).logPartition)).toBe(true);
  expect(exactIsing(m).probabilities.reduce((s, p) => s + p, 0)).toBeCloseTo(
    1,
    14,
  );
  expect(isingReference(m).mean).toBeCloseTo(-4, 10);
});
describe.each(['metropolis', 'heat-bath'] as const)(
  '%s local kernel',
  (kind) => {
    it.each(presets)(
      'has detailed balance, stationary measure and self transitions on %s',
      (preset) => {
        const m = isingPreset(preset);
        m.parameters.fields.v0 = 0.2;
        const exact = exactIsing(m),
          n = m.parameters.domain.vertices.length,
          size = 2 ** n;
        const P = Array.from({ length: size }, () =>
          Array<number>(size).fill(0),
        );
        for (let k = 0; k < size; k++)
          for (let i = 0; i < n; i++) {
            const other = k ^ (1 << i),
              p =
                kind === 'metropolis'
                  ? 0.5 * Math.min(1, Math.exp(-flipDifference(m, k, i)))
                  : spinAt(k, i) === 1
                    ? 1 - conditionalPlus(m, k, i)
                    : conditionalPlus(m, k, i);
            P[k]![other]! += p / n;
            P[k]![k]! += (1 - p) / n;
          }
        for (let k = 0; k < size; k++) {
          expect(P[k]!.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 14);
          expect(P[k]![k]).toBeGreaterThan(0);
          expect(
            P.reduce((s, row, j) => s + exact.probabilities[j]! * row[k]!, 0),
          ).toBeCloseTo(exact.probabilities[k]!, 13);
          for (let j = 0; j < size; j++)
            expect(exact.probabilities[k]! * P[k]![j]!).toBeCloseTo(
              exact.probabilities[j]! * P[j]![k]!,
              13,
            );
          for (let i = 0; i < n; i++)
            expect(P[k]![k ^ (1 << i)]).toBeGreaterThan(0);
        }
      },
    );
    it('records actual local draws and state changes', () => {
      const m = isingPreset('ring'),
        values = [0.3, 0.8, 0.2],
        rng = { uniform: () => values.shift()! };
      const t = isingTransition(
        m,
        kind === 'metropolis'
          ? { kind, width: 1, warmup: 0 }
          : { kind, warmup: 0 },
        15,
        rng,
      );
      expect(t.ising?.index).toBe(1);
      expect(t.ising?.siteUniform).toBe(0.3);
      expect(t.ising?.oldSpin).toBe(1);
      if (t.kind === 'metropolis') {
        expect(t.delta).toBe(2);
        expect(t.accepted).toBe(false);
        expect(t.result).toBe(15);
        expect(t.uniform).toBe(0.2);
      } else if (t.kind === 'heat-bath') {
        expect(t.probabilityPlus).toBeCloseTo(1 / (1 + Math.exp(-2)), 14);
        expect(t.result).toBe(15);
        expect(t.uniform).toBe(0.8);
      }
    });
  },
);
it('independent exact draws match mean within an analytic 6-SE bound', () => {
  const m = isingPreset('torus');
  m.parameters.fields.v0 = 0.4;
  const rng = createRng(384),
    ref = isingReference(m),
    count = 20000;
  let sum = 0;
  for (let i = 0; i < count; i++)
    sum += observableValue(
      m,
      isingTransition(m, { kind: 'direct' }, null, rng).result,
    );
  expect(Math.abs(sum / count - ref.mean)).toBeLessThan(
    6 * Math.sqrt(ref.variance / count),
  );
});

it('K4 zero weights realize all 64 simple four-site interaction graphs without deleting topology', () => {
  for (let mask = 0; mask < 64; mask++) {
    const complete = isingPreset('complete');
    complete.parameters.domain.edges.forEach(
      (e, i) =>
        (complete.parameters.couplings[e.id] =
          mask & (1 << i) ? (i % 2 ? -0.7 : 0.4) : 0),
    );
    const sparse = structuredClone(complete);
    sparse.parameters.domain.edges = sparse.parameters.domain.edges.filter(
      (e) => sparse.parameters.couplings[e.id] !== 0,
    );
    expect(complete.parameters.domain.edges).toHaveLength(6);
    for (let state = 0; state < 16; state++)
      expect(isingAction(complete, state)).toBeCloseTo(
        isingAction(sparse, state),
        13,
      );
    expect(exactIsing(complete).probabilities).toEqual(
      exactIsing(sparse).probabilities,
    );
  }
  const torus = isingPreset('torus');
  Object.keys(torus.parameters.couplings).forEach(
    (k) => (torus.parameters.couplings[k] = 0),
  );
  validateIsing(torus);
  expect(torus.parameters.domain.edges).toHaveLength(8);
  expect(torus.parameters.domain.faces).toHaveLength(4);
  expect(exactIsing(torus).probabilities).toEqual(Array(16).fill(1 / 16));
});

it('self-link constants shift log Z without changing probabilities or local conditionals', () => {
  const base = isingPreset('ring'),
    looped = structuredClone(base);
  looped.parameters.domain.edges.push({ id: 'loop', tail: 'v2', head: 'v2' });
  looped.parameters.couplings.loop = -1.7;
  expect(exactIsing(looped).logPartition).toBeCloseTo(
    exactIsing(base).logPartition - 1.7,
    13,
  );
  exactIsing(looped).probabilities.forEach((p, k) => {
    expect(p).toBeCloseTo(exactIsing(base).probabilities[k]!, 14);
    for (let site = 0; site < 4; site++)
      expect(conditionalPlus(looped, k, site)).toBe(
        conditionalPlus(base, k, site),
      );
  });
});
it('reversing an edge and its signed incidences preserves the oriented cell complex and Ising action', () => {
  const base = isingPreset('torus'),
    reversed = structuredClone(base),
    edge = reversed.parameters.domain.edges[0]!;
  [edge.tail, edge.head] = [edge.head, edge.tail];
  for (const face of reversed.parameters.domain.faces)
    for (const b of face.boundary)
      if (b.edgeId === edge.id) b.sign = b.sign === 1 ? -1 : 1;
  validateDomain(reversed.parameters.domain);
  for (let state = 0; state < 16; state++)
    expect(isingAction(reversed, state)).toBe(isingAction(base, state));
});
