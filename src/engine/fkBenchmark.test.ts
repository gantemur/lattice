import { createRng } from '../algorithms/rng';
import { pottsClusterTransition } from '../algorithms/pottsClusterSampler';
import { expect, it } from 'vitest';
import { PottsRun } from './pottsRun';
import type { PottsConfiguration } from './pottsRun';
import { pottsGraph } from '../domain/pottsDomain';
import type { PottsGeometrySettings } from '../domain/pottsDomain';
import { pottsModel } from '../models/potts';
import type { PottsModel } from '../models/potts';
import { bfsComponents, independentJoint } from '../test/fkOracle';

// Declared regression budgets, not fitted seeds or independent-sample SEs.
const seeds = [17, 271, 12345, 89231],
  tinySamples = 4000;
function advance(run: PottsRun, n: number, cap = 32) {
  while (n) {
    const batch = Math.min(cap, n);
    run.advance(batch);
    n -= batch;
  }
}
/** Independent finite joint sums: Cartesian colors, arithmetic bond words,
 * direct edge factors and BFS; no production FK/Potts reference/observable. */
function oracle(m: PottsModel) {
  let states: number[][] = [[]];
  for (let i = 0; i < m.size; i++)
    states = states.flatMap((s) =>
      Array.from({ length: m.q }, (_, c) => [...s, c]),
    );
  const flags = Array.from({ length: 2 ** m.bonds.length }, (_, word) =>
    m.bonds.map((_, e) => Math.floor(word / 2 ** e) % 2),
  );
  const bonds = flags.map(() => 0),
    spins = states.map(() => 0),
    largest = Array<number>(m.size + 1).fill(0);
  const means = {
    m0: 0,
    majority: 0,
    action: 0,
    agreement: 0,
    occupied: 0,
    clusters: 0,
    largestFraction: 0,
    connectivity: 0,
  };
  let z = 0;
  flags.forEach((f, a) => {
    const c = bfsComponents(m, f),
      occupied = f.reduce((a, b) => a + b, 0);
    states.forEach((s, i) => {
      const w = independentJoint(m, s, f);
      z += w;
      bonds[a]! += w;
      spins[i]! += w;
      const populations = Array.from(
        { length: m.q },
        (_, color) => s.filter((v) => v === color).length / m.size,
      );
      const same = m.bonds.map((b) => Number(s[b.tail] === s[b.head]));
      means.m0 += (w * (m.q * populations[0]! - 1)) / (m.q - 1);
      means.majority += (w * (m.q * Math.max(...populations) - 1)) / (m.q - 1);
      means.action -=
        w * m.bonds.reduce((sum, b, e) => sum + b.K * same[e]!, 0);
      means.agreement +=
        (w * same.reduce((a, b) => a + b, 0)) / Math.max(1, same.length);
      means.occupied += w * occupied;
      means.clusters += w * c.count;
      means.largestFraction += (w * Math.max(...c.sizes)) / m.size;
      means.connectivity += w * Number(c.labels[0] === c.labels[m.size - 1]);
      largest[Math.max(...c.sizes)]! += w;
    });
  });
  for (const key of Object.keys(means) as (keyof typeof means)[])
    means[key] /= z;
  return {
    means,
    bonds: bonds.map((v) => v / z),
    spins: spins.map((v) => v / z),
    largest: largest.map((v) => v / z),
    states,
  };
}
const cases: { name: string; q: 2 | 3 | 4; geometry: PottsGeometrySettings }[] =
  [];
for (const q of [2, 3, 4] as const)
  cases.push({ name: `dimer q${q}`, q, geometry: pottsGraph('dimer', 0.7) });
cases.push({
  name: 'triangle q3',
  q: 3,
  geometry: pottsGraph('triangle', 0.7),
});
for (const q of [2, 4] as const)
  cases.push({ name: `torus q${q}`, q, geometry: pottsGraph('torus', 0.7) });
cases.push({
  name: 'mixed anisotropic q3',
  q: 3,
  geometry: {
    kind: 'lattice',
    shape: { lx: 2, ly: 2, periodicX: true, periodicY: false },
    kx: 0.2,
    ky: 1.1,
  },
});
const nonuniform = pottsGraph('square');
if (nonuniform.kind === 'graph')
  nonuniform.couplings = { e0: 0, e1: 0.3, e2: 0.8, e3: 1.3 };
cases.push(
  { name: 'nonuniform present zero q4', q: 4, geometry: nonuniform },
  { name: 'zero torus q3', q: 3, geometry: pottsGraph('torus', 0) },
);
for (const scenario of cases)
  for (const sampler of ['fk-direct', 'sw'] as const)
    it(`fixed multiseed joint equilibrium: ${scenario.name}, ${sampler}`, () => {
      const parameters = { q: scenario.q, h: 0, geometry: scenario.geometry },
        model = pottsModel(parameters),
        reference = oracle(model);
      const totals = {
        m0: 0,
        majority: 0,
        action: 0,
        agreement: 0,
        occupied: 0,
        clusters: 0,
        largestFraction: 0,
        connectivity: 0,
      };
      const bondWords = reference.bonds.map(() => 0),
        spinWords = reference.spins.map(() => 0),
        largest = reference.largest.map(() => 0);
      let totalBondVisits = 0,
        totalColors = 0;
      for (const seed of seeds) {
        const configuration: PottsConfiguration = {
          parameters,
          seed,
          ...(sampler === 'sw'
            ? { sampler, warmupTrajectories: 200, strideTrajectories: 2 }
            : { sampler, warmup: 0, stride: 1 }),
        };
        const run = new PottsRun(configuration);
        // Collect the full joint word distribution from the pure sampler, then
        // replay the same updates through the engine in bounded batches. Avoid
        // cloning the entire 256-record snapshot for each benchmark sample.
        const rng = createRng(seed),
          colors = new Uint8Array(model.size);
        if (sampler === 'sw')
          for (let n = 0; n < 200; n++)
            pottsClusterTransition(model, sampler, colors, rng);
        for (let n = 0; n < tinySamples; n++) {
          if (sampler === 'sw')
            pottsClusterTransition(model, sampler, colors, rng);
          const t = pottsClusterTransition(model, sampler, colors, rng);
          const word = Array.from(t.flags).reduce(
            (s, v, e) => s + v * 2 ** e,
            0,
          );
          const spin = Array.from(colors).reduce(
            (s, c) => s * scenario.q + c,
            0,
          );
          bondWords[word]!++;
          spinWords[spin]!++;
          if (
            model.bonds.some(
              (b, e) => t.flags[e] && colors[b.tail] !== colors[b.head],
            )
          )
            throw Error('Occupied bond violates joint support');
        }
        advance(run, sampler === 'sw' ? 200 + 2 * tinySamples : tinySamples);
        expect(run.snapshot().colors).toEqual(colors);
        const s = run.snapshot().segments[0]!,
          fk = s.fk!;
        expect(s.samples).toBe(tinySamples);
        for (const key of ['m0', 'majority', 'action', 'agreement'] as const)
          totals[key] += s.moments[key]!.mean / seeds.length;
        for (const key of ['occupied', 'clusters', 'largestFraction'] as const)
          totals[key] += fk.moments[key].mean / seeds.length;
        totals.connectivity +=
          fk.pairCounts![0]![model.size - 1]! / tinySamples / seeds.length;
        fk.largestSizes.forEach((v, i) => {
          largest[i]! += v;
        });
        totalBondVisits += fk.work.bondVisits;
        totalColors += fk.work.colorAssignments;
      }
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
        const scale =
          key === 'action'
            ? Math.max(1, model.bonds.length)
            : key === 'occupied'
              ? Math.max(1, model.bonds.length)
              : key === 'clusters'
                ? model.size
                : 1;
        expect(
          Math.abs(totals[key] - reference.means[key]) / scale,
        ).toBeLessThan(0.045);
      }
      for (const [counts, probabilities] of [
        [bondWords, reference.bonds],
        [spinWords, reference.spins],
        [largest, reference.largest],
      ])
        counts!.forEach((v, i) =>
          expect(
            Math.abs(v / (tinySamples * seeds.length) - probabilities![i]!),
          ).toBeLessThan(0.035),
        );
      console.log(
        JSON.stringify({
          case: scenario.name,
          sampler,
          exact: reference.means,
          observed: totals,
          bondVisits: totalBondVisits,
          componentColors: totalColors,
        }),
      );
    });
for (const q of [2, 3, 4] as const)
  for (const K of [0, 0.35])
    it(`8x8 SW product/symmetry and secondary local comparison q${q} K${K}`, () => {
      const parameters = {
        q,
        h: 0,
        geometry: {
          kind: 'lattice' as const,
          shape: { lx: 8, ly: 8, periodicX: true, periodicY: true },
          kx: K,
          ky: K,
        },
      };
      const means: {
        sampler: string;
        p0: number;
        agreement: number;
        occupied: number;
        bondVisits: number;
        colors: number;
      }[] = [];
      for (const sampler of ['sw', 'heat-bath'] as const) {
        let p0 = 0,
          agreement = 0,
          occupied = 0,
          bondVisits = 0,
          colors = 0;
        for (const seed of seeds) {
          const c: PottsConfiguration = {
            parameters,
            seed,
            ...(sampler === 'sw'
              ? { sampler, warmupTrajectories: 200, strideTrajectories: 2 }
              : { sampler, warmup: 200, stride: 2 }),
          };
          const run = new PottsRun(c);
          advance(
            run,
            (200 + 2 * 1600) * (sampler === 'sw' ? 1 : 64),
            sampler === 'sw' ? 32 : 4096,
          );
          const s = run.snapshot().segments[0]!;
          expect(s.samples).toBe(1600);
          p0 += s.moments.p0!.mean / 4;
          agreement += s.moments.agreement!.mean / 4;
          if (s.fk) {
            occupied += s.fk.moments.occupiedFraction.mean / 4;
            bondVisits += s.fk.work.bondVisits;
            colors += s.fk.work.colorAssignments;
          }
        }
        expect(Math.abs(p0 - 1 / q)).toBeLessThan(0.025);
        if (K === 0) expect(Math.abs(agreement - 1 / q)).toBeLessThan(0.015);
        else expect(agreement).toBeGreaterThan(1 / q);
        means.push({ sampler, p0, agreement, occupied, bondVisits, colors });
      }
      expect(Math.abs(means[0]!.agreement - means[1]!.agreement)).toBeLessThan(
        0.025,
      );
      expect(
        Math.abs(means[0]!.occupied - (1 - Math.exp(-K)) * means[0]!.agreement),
      ).toBeLessThan(0.015);
      console.log(JSON.stringify({ case: `8x8 q${q} K${K}`, means }));
    });
