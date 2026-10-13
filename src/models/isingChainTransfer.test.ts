import { describe, expect, it } from 'vitest';
import { createIndexedLattice } from '../domain/indexedLattice';
import { flipEnergy, totalEnergy } from './latticeIsing';
import type { LatticeParameters } from './latticeIsing';
import {
  finiteChainReference,
  transferMatrix,
  transferSpectrum,
} from './isingChainTransfer';
import { exactIsing, isingPreset } from './ising';

const chain = (
  n: number,
  periodicX: boolean,
  jx = 1,
  field = 0,
  temperature = 2,
): LatticeParameters => ({
  lx: n,
  ly: 1,
  periodicX,
  periodicY: false,
  jx,
  jy: 0,
  field,
  temperature,
});

/** Deliberately independent sum over spin words and literal adjacent pairs. */
function enumerate(p: LatticeParameters) {
  const states = Array.from({ length: 2 ** p.lx }, (_, code) =>
    Array.from({ length: p.lx }, (_, i) => (code & (1 << i) ? 1 : -1)),
  );
  const energy = (s: number[]) => {
    let H = -p.field * s.reduce((a, b) => a + b, 0);
    for (let i = 0; i < p.lx - 1; i++) H -= p.jx * s[i]! * s[i + 1]!;
    if (p.periodicX) H -= p.jx * s[p.lx - 1]! * s[0]!;
    return H;
  };
  const actions = states.map((s) => energy(s) / p.temperature);
  const offset = Math.min(...actions);
  const weights = actions.map((a) => Math.exp(offset - a));
  const z = weights.reduce((a, b) => a + b, 0);
  const average = (f: (s: number[]) => number) =>
    states.reduce((sum, s, i) => sum + weights[i]! * f(s), 0) / z;
  return {
    logZ: Math.log(z) - offset,
    m: average((s) => s.reduce((a, b) => a + b, 0) / p.lx),
    e: average((s) => energy(s) / p.lx),
    chi:
      (average((s) => s.reduce((a, b) => a + b, 0) ** 2) -
        average((s) => s.reduce((a, b) => a + b, 0)) ** 2) /
      (p.lx * p.temperature),
    pairs: (r: number) =>
      average((s) => {
        const count = p.periodicX ? p.lx : p.lx - r;
        let sum = 0;
        for (let i = 0; i < count; i++) sum += s[i]! * s[(i + r) % p.lx]!;
        return sum / count;
      }),
    connected: (r: number) => {
      const origins = p.periodicX ? p.lx : p.lx - r;
      let sum = 0;
      for (let i = 0; i < origins; i++) {
        const j = (i + r) % p.lx;
        sum +=
          average((s) => s[i]! * s[j]!) -
          average((s) => s[i]!) * average((s) => s[j]!);
      }
      return sum / origins;
    },
  };
}

describe('one-dimensional geometry and 2×2 transfer reference', () => {
  it('constructs actual open/ring bonds without vertical self-links', () => {
    for (const [n, periodic] of [
      [2, false],
      [3, true],
      [4, false],
      [5, true],
    ] as const) {
      const l = createIndexedLattice(chain(n, periodic));
      expect([
        l.size,
        l.horizontalBonds,
        l.verticalBonds,
        l.tails.length,
      ]).toEqual([n, periodic ? n : n - 1, 0, periodic ? n : n - 1]);
      expect([...l.axes]).toEqual(Array(l.tails.length).fill(0));
      expect([...l.tails].every((tail, i) => tail !== l.heads[i])).toBe(true);
    }
    expect(() => createIndexedLattice(chain(2, true))).toThrow();
    expect(() =>
      createIndexedLattice({ ...chain(4, false), periodicY: true }),
    ).toThrow();
  });

  it('matches independent enumeration over boundaries, signs, fields and temperatures', () => {
    for (const p of [
      chain(2, false, 1, 0, 2),
      chain(3, false, -1.3, 0.7, 1.8),
      chain(3, true, -1, 0, 0.3),
      chain(4, true, 0.6, -0.9, 3),
      chain(5, true, 1.2, 0.5, 0.5),
      chain(5, false, -2, -0.4, 7),
      chain(4, true, 10, -10, 0.05),
      chain(3, true, -10, 10, 0.05),
    ]) {
      const exact = finiteChainReference(p),
        brute = enumerate(p);
      expect(exact.logPartition).toBeCloseTo(brute.logZ, 8);
      expect(exact.meanMagnetization).toBeCloseTo(brute.m, 8);
      expect(exact.meanEnergy).toBeCloseTo(brute.e, 8);
      expect(exact.susceptibility).toBeCloseTo(brute.chi, 8);
      for (const point of exact.correlations)
        expect(point.raw).toBeCloseTo(brute.pairs(point.r), 8);
      for (const point of exact.correlations)
        expect(point.connected).toBeCloseTo(brute.connected(point.r), 8);
    }
  });

  it('agrees with the existing four-site graph ring after K=J/T and b=h/T', () => {
    const p = chain(4, true, 1.2, -0.3, 2);
    const model = isingPreset('ring');
    for (const edge of model.parameters.domain.edges)
      model.parameters.couplings[edge.id] = p.jx / p.temperature;
    for (const vertex of model.parameters.domain.vertices)
      model.parameters.fields[vertex.id] = p.field / p.temperature;
    const graph = exactIsing(model),
      transfer = finiteChainReference(p);
    expect(transfer.logPartition).toBeCloseTo(graph.logPartition, 10);
    expect(transfer.meanMagnetization).toBeCloseTo(
      graph.means.reduce((a, b) => a + b, 0) / 4,
      10,
    );
    expect(transfer.correlations[1]!.raw).toBeCloseTo(
      graph.correlations.reduce((sum, row, i) => sum + row[(i + 1) % 4]!, 0) /
        4,
      10,
    );
  });

  it('has the hand-checkable zero-field formulas and alternating AF sign', () => {
    const K = 0.7,
      u = Math.tanh(K);
    for (const periodic of [false, true]) {
      const n = 5,
        exact = finiteChainReference(chain(n, periodic, K, 0, 1));
      for (const { r, raw } of exact.correlations)
        expect(raw).toBeCloseTo(
          periodic ? (u ** r + u ** (n - r)) / (1 + u ** n) : u ** r,
          10,
        );
    }
    const af = finiteChainReference(chain(6, true, -1, 0, 1));
    expect(af.spectrum.ratio).toBeLessThan(0);
    expect(af.correlations[1]!.raw).toBeLessThan(0);
    expect(af.correlations[2]!.raw).toBeGreaterThan(0);
    expect(
      finiteChainReference(chain(4, false, 0, 0, 1)).spectrum.correlationLength,
    ).toBe(0);
    expect(transferMatrix(0, 0)).toEqual([1, 1, 1, 1]);
    expect(transferSpectrum(0.7, 0).correlationLength).toBeCloseTo(
      -1 / Math.log(u),
      10,
    );
  });

  it('keeps allowed low-temperature and strong-field finite-size references finite', () => {
    for (const p of [
      chain(64, true, 10, 10, 0.05),
      chain(64, false, -10, -10, 0.05),
      chain(63, true, -10, 0, 0.05),
      chain(64, true, 0, 10, 0.05),
    ]) {
      const exact = finiteChainReference(p);
      expect(Number.isFinite(exact.logPartition)).toBe(true);
      expect(Number.isFinite(exact.meanEnergy)).toBe(true);
      expect(Math.abs(exact.meanMagnetization)).toBeLessThanOrEqual(
        1.000000001,
      );
      expect(
        exact.correlations.every(
          (q) => Number.isFinite(q.raw) && Math.abs(q.raw) <= 1.000000001,
        ),
      ).toBe(true);
    }
  });

  it('local flip costs equal independent full-energy differences', () => {
    for (const p of [
      chain(2, false),
      chain(3, true),
      chain(5, false, -1.2, 0.3),
      chain(5, true, 2, -0.8),
    ]) {
      const lattice = createIndexedLattice(p);
      for (let code = 0; code < 2 ** p.lx; code++) {
        const spins = Int8Array.from({ length: p.lx }, (_, i) =>
          code & (1 << i) ? 1 : -1,
        );
        const whole = totalEnergy(lattice, p, spins);
        for (let i = 0; i < p.lx; i++) {
          const changed = spins.slice();
          changed[i] = -changed[i]!;
          expect(flipEnergy(lattice, p, spins, i)).toBeCloseTo(
            totalEnergy(lattice, p, changed) - whole,
            10,
          );
        }
      }
    }
  });
});
