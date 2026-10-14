import { expect, it } from 'vitest';
import { pottsGraph } from '../domain/pottsDomain';
import { pottsModel } from '../models/potts';
import { exactPotts } from '../models/pottsExact';
import { pottsClusterTransition } from './pottsClusterSampler';
import { bfsComponents, conditionalBonds } from '../test/fkOracle';
import { createRng } from './rng';

for (const q of [2, 3, 4] as const)
  for (const geometry of ['dimer', 'triangle', 'square', 'torus'] as const) {
    if (geometry === 'torus' && q !== 2) continue;
    it(`independent complete SW matrix q=${q} ${geometry}`, () => {
      const model = pottsModel({
        q,
        h: 0,
        geometry: pottsGraph(geometry, 0.7),
      });
      // Independent Cartesian state enumeration; retain production probabilities
      // only as the stationary measure already checked against counting formulas.
      let states: number[][] = [[]];
      for (let i = 0; i < model.size; i++)
        states = states.flatMap((s) =>
          Array.from({ length: q }, (_, c) => [...s, c]),
        );
      const matrix = states.map(() => states.map(() => 0));
      const words = Array.from({ length: 2 ** model.bonds.length }, (_, n) =>
        model.bonds.map((_, e) => Math.floor(n / 2 ** e) % 2),
      );
      const spin = exactPotts(model),
        pi = states.map(
          (s) => spin.probabilities[s.reduce((n, c, i) => n + c * q ** i, 0)]!,
        );
      states.forEach((before, i) =>
        words.forEach((flags) => {
          const probability = conditionalBonds(model, before, flags);
          if (!probability) return;
          const components = bfsComponents(model, flags);
          states.forEach((after, j) => {
            if (
              model.bonds.some(
                (b, e) => flags[e] && after[b.tail] !== after[b.head],
              )
            )
              return;
            matrix[i]![j]! += probability / q ** components.count;
            // Exhaust every dimer conditional branch using interior uniforms, and
            // selected all-equal states on larger graphs. No production components
            // or probability helper decides the expected state or draw count.
            if (geometry !== 'dimer' && i !== 0) return;
            const uniforms = model.bonds.map((b, e) =>
              flags[e] ? (1 - Math.exp(-b.K)) / 2 : (2 - Math.exp(-b.K)) / 2,
            );
            for (let c = 0; c < components.count; c++)
              uniforms.push((after[components.labels.indexOf(c)]! + 0.5) / q);
            let used = 0;
            const actual = Uint8Array.from(before);
            const trace = pottsClusterTransition(model, 'sw', actual, {
              uniform: () => uniforms[used++]!,
            });
            expect(Array.from(actual)).toEqual(after);
            expect(Array.from(trace.flags)).toEqual(flags);
            expect(used).toBe(model.bonds.length + components.count);
            expect(trace.uniformCount).toBe(used);
          });
        }),
      );
      matrix.forEach((row, i) => {
        expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        // All entries strictly positive: the empty-bond route reaches every state.
        expect(row.every((p) => p > 0)).toBe(true);
        expect(row[i]).toBeGreaterThan(0);
        row.forEach((p, j) =>
          expect(pi[i]! * p).toBeCloseTo(pi[j]! * matrix[j]![i]!, 12),
        );
      });
      states.forEach((_, j) =>
        expect(
          matrix.reduce((sum, row, i) => sum + pi[i]! * row[j]!, 0),
        ).toBeCloseTo(pi[j]!, 12),
      );
    });
  }
for (const q of [2, 3, 4] as const)
  for (const geometry of ['site', 'dimer', 'triangle', 'torus'] as const)
    it(`K=0 one-step independent product draw q=${q} ${geometry}`, () => {
      const model = pottsModel({ q, h: 0, geometry: pottsGraph(geometry, 0) });
      const first = new Uint8Array(model.size),
        second = new Uint8Array(model.size).fill(q - 1);
      const a = pottsClusterTransition(model, 'sw', first, createRng(12345));
      const b = pottsClusterTransition(model, 'sw', second, createRng(12345));
      expect(first).toEqual(second);
      expect(a.flags.every((v) => v === 0)).toBe(true);
      expect(a.count).toBe(model.size);
      expect(a.uniformCount).toBe(model.bonds.length + model.size);
      expect(a.componentColors).toEqual(b.componentColors);
    });
it('exact FK draws consume 1+k even at K=0 and ignore the previous configuration', () => {
  const model = pottsModel({ q: 3, h: 0, geometry: pottsGraph('torus', 0) });
  const a = new Uint8Array(4),
    b = new Uint8Array(4).fill(2),
    rngA = createRng(27),
    rngB = createRng(27);
  for (let i = 0; i < 20; i++) {
    const trace = pottsClusterTransition(model, 'fk-direct', a, rngA);
    pottsClusterTransition(model, 'fk-direct', b, rngB);
    expect(a).toEqual(b);
    expect(trace.uniformCount).toBe(5);
  }
});
it('parallel bonds, self-links, disagreeing endpoints and present zero bonds each get a trial', () => {
  const geometry = pottsGraph('dimer', 0.7);
  if (geometry.kind !== 'graph') throw Error();
  geometry.domain.edges.push(
    { id: 'parallel', tail: 'v0', head: 'v1' },
    { id: 'self', tail: 'v0', head: 'v0' },
    { id: 'zero', tail: 'v1', head: 'v1' },
  );
  Object.assign(geometry.couplings, { parallel: 0.7, self: 0.7, zero: 0 });
  const model = pottsModel({ q: 3, h: 0, geometry });
  for (const colors of [
    [0, 0],
    [0, 1],
  ]) {
    const draws = [0.1, 0.9, 0.1, 0.1, 0.2, 0.2];
    let n = 0;
    const trace = pottsClusterTransition(model, 'sw', Uint8Array.from(colors), {
      uniform: () => draws[n++]!,
    });
    expect(Array.from(trace.flags)).toEqual([colors[1] === 0 ? 1 : 0, 0, 1, 0]);
    expect(n).toBe(4 + trace.count);
  }
});
it('invalid FK requests fail before RNG or colors change', () => {
  const model = pottsModel({ q: 3, h: 1, geometry: pottsGraph('dimer') }),
    colors = new Uint8Array(2);
  let draws = 0;
  expect(() =>
    pottsClusterTransition(model, 'sw', colors, {
      uniform: () => {
        draws++;
        return 0.5;
      },
    }),
  ).toThrow('h=0');
  expect(draws).toBe(0);
  expect(colors).toEqual(new Uint8Array(2));
});
