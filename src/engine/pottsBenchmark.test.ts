import { expect, it } from 'vitest';
import { PottsRun, defaultSmallPotts } from './pottsRun';
import type { LocalPottsSettings, PottsSegment } from './pottsRun';
import { pottsGraph } from '../domain/pottsDomain';
import type { PottsGeometrySettings } from '../domain/pottsDomain';
import { pottsModel } from '../models/potts';
import type { PottsModel } from '../models/potts';

// Fixed BEFORE observations: four seeds, 200 warm-up sweeps, stride two,
// 6000 retained tiny configurations/seed. These are broad regression gates,
// not independent-sample confidence intervals for correlated local chains.
const seeds = [17, 271, 12345, 89231];
const tinySamples = 6000;
function simulate(
  c: LocalPottsSettings & { seed: number },
  samples: number,
): PottsSegment {
  const run = new PottsRun(c),
    size = pottsModel(c.parameters).size;
  let remaining =
    c.sampler === 'direct' ? samples : size * (c.warmup + c.stride * samples);
  while (remaining) {
    const batch = Math.min(remaining, 4096);
    run.advance(batch);
    remaining -= batch;
  }
  const snapshot = run.snapshot(),
    segment = snapshot.segments[0]!;
  expect(segment.samples).toBe(samples);
  expect(snapshot.draws).toBe(
    snapshot.updates *
      (c.sampler === 'direct' ? 1 : c.sampler === 'heat-bath' ? 2 : 3),
  );
  return segment;
}
/** Independent Cartesian enumeration and observable formulas. Does not call
 * production action, base-q codec, observables or exact-reference routines. */
function oracle(m: PottsModel) {
  let states: number[][] = [[]];
  for (let i = 0; i < m.size; i++)
    states = states.flatMap((s) =>
      Array.from({ length: m.q }, (_, c) => [...s, c]),
    );
  const actions = states.map(
    (s) =>
      -m.bonds.reduce(
        (sum, b) => sum + b.K * (s[b.tail] === s[b.head] ? 1 : 0),
        0,
      ) -
      m.h * s.filter((c) => c === 0).length,
  );
  const offset = Math.min(...actions),
    weights = actions.map((s) => Math.exp(offset - s)),
    z = weights.reduce((a, b) => a + b, 0),
    p = weights.map((w) => w / z);
  const values = states.map((s, n) => {
    const fractions = Array.from(
      { length: m.q },
      (_, c) => s.filter((x) => x === c).length / m.size,
    );
    return {
      action: actions[n]!,
      m0: (m.q * fractions[0]! - 1) / (m.q - 1),
      majority: (m.q * Math.max(...fractions) - 1) / (m.q - 1),
      agreement:
        m.bonds.filter((b) => s[b.tail] === s[b.head]).length / m.bonds.length,
      ...Object.fromEntries(fractions.map((x, c) => [`p${c}`, x])),
    };
  });
  return {
    means: Object.fromEntries(
      Object.keys(values[0]!).map((key) => [
        key,
        values.reduce(
          (sum, v, n) => sum + p[n]! * (v as Record<string, number>)[key]!,
          0,
        ),
      ]),
    ),
    sites: Array.from({ length: m.size }, (_, i) =>
      Array.from({ length: m.q }, (_, c) =>
        states.reduce((sum, s, n) => sum + (s[i] === c ? p[n]! : 0), 0),
      ),
    ),
    pair: states.reduce(
      (sum, s, n) => sum + (s[0] === s[m.size - 1] ? p[n]! : 0),
      0,
    ),
  };
}
function geometry(kind: string): PottsGeometrySettings {
  if (kind === 'rectangle')
    return {
      kind: 'lattice',
      shape: { lx: 2, ly: 2, periodicX: true, periodicY: false },
      kx: -0.6,
      ky: 0.9,
    };
  const g = pottsGraph(
    kind as 'dimer' | 'triangle' | 'torus',
    kind === 'triangle' ? -0.7 : 0.7,
  );
  if (g.kind === 'graph' && kind === 'torus')
    g.domain.edges.forEach((e) => {
      g.couplings[e.id] = e.axis === 0 ? -0.6 : 0.9;
    });
  return g;
}
for (const q of [2, 3, 4] as const)
  for (const kind of ['dimer', 'triangle', 'torus', 'rectangle'])
    for (const sampler of ['direct', 'metropolis', 'heat-bath'] as const)
      it(`four-seed tiny q=${q} ${kind} ${sampler}`, () => {
        const config = {
            ...defaultSmallPotts,
            parameters: { q, h: 0.3, geometry: geometry(kind) },
            sampler,
            warmup: 200,
            stride: 2,
          },
          m = pottsModel(config.parameters),
          reference = oracle(m);
        const segments = seeds.map((seed) =>
          simulate({ ...config, seed }, tinySamples),
        );
        let worst = 0;
        for (const [key, expected] of Object.entries(reference.means)) {
          const measured =
              segments.reduce((s, g) => s + g.moments[key]!.mean, 0) /
              seeds.length,
            error = Math.abs(measured - expected);
          const tolerance =
            key === 'action' ? 0.055 * Math.max(1, m.bonds.length) : 0.055;
          expect(error, `${key} q=${q} ${kind} ${sampler}`).toBeLessThan(
            tolerance,
          );
          if (key !== 'action') worst = Math.max(worst, error);
        }
        for (let i = 0; i < m.size; i++)
          for (let c = 0; c < q; c++)
            expect(
              Math.abs(
                segments.reduce(
                  (s, g) => s + g.occupancy[i]![c]! / tinySamples,
                  0,
                ) /
                  4 -
                  reference.sites[i]![c]!,
              ),
            ).toBeLessThan(0.055);
        expect(
          Math.abs(
            segments.reduce(
              (s, g) => s + g.pairCounts![0]![m.size - 1]! / tinySamples,
              0,
            ) /
              4 -
              reference.pair,
          ),
        ).toBeLessThan(0.055);
        console.info(
          JSON.stringify({
            pottsTiny: {
              q,
              kind,
              sampler,
              retained: 4 * tinySamples,
              attemptsPerSeed: segments[0]!.updates,
              referenceM0: reference.means.m0,
              sampledM0:
                segments.reduce((s, g) => s + g.moments.m0!.mean, 0) / 4,
              worst,
            },
          }),
        );
      }, 30000);
// Large interacting checks are symmetry/bounds and secondary kernel agreement,
// not a claimed exact solution. Decoupled systems have an independent product law.
for (const q of [2, 3, 4] as const)
  for (const scenario of [
    'independent',
    'ferromagnetic',
    'anisotropic',
  ] as const)
    it(`8×8 q=${q} ${scenario}: independent-site or symmetry/consistency checks`, () => {
      const h = scenario === 'independent' ? 0.4 : 0,
        kx =
          scenario === 'independent'
            ? 0
            : scenario === 'anisotropic'
              ? -0.25
              : 0.35,
        ky = scenario === 'independent' ? 0 : 0.35;
      const shape = {
          lx: 8,
          ly: 8,
          periodicX: true,
          periodicY: scenario !== 'anisotropic',
        },
        N = 3000;
      const groups = (['metropolis', 'heat-bath'] as const).map((sampler) =>
        seeds.map((seed) =>
          simulate(
            {
              parameters: {
                q,
                h,
                geometry: { kind: 'lattice', shape, kx, ky },
              },
              sampler,
              seed,
              warmup: 200,
              stride: 2,
            },
            N,
          ),
        ),
      );
      const average = (g: PottsSegment[], key: string) =>
        g.reduce((s, v) => s + v.moments[key]!.mean, 0) / 4;
      for (const group of groups) {
        for (let c = 0; c < q; c++)
          expect(
            Math.abs(
              average(group, `p${c}`) -
                (scenario === 'independent'
                  ? (c === 0 ? Math.exp(h) : 1) / (Math.exp(h) + q - 1)
                  : 1 / q),
            ),
          ).toBeLessThan(0.035);
        expect(average(group, 'majority')).toBeGreaterThan(0);
        expect(average(group, 'majority')).toBeLessThan(1);
        if (scenario === 'independent') {
          const p0 = Math.exp(h) / (Math.exp(h) + q - 1),
            other = 1 / (Math.exp(h) + q - 1),
            same = p0 * p0 + (q - 1) * other * other;
          expect(average(group, 'actionDensity')).toBeCloseTo(-h * p0, 2);
          for (const axis of ['spatialX', 'spatialY'] as const)
            for (let lag = 1; lag < 8; lag++)
              expect(
                Math.abs(
                  group.reduce((s, g) => s + g[axis][lag]!.moments.mean, 0) /
                    4 -
                    same,
                ),
              ).toBeLessThan(0.035);
        } else if (scenario === 'ferromagnetic')
          expect(average(group, 'agreement')).toBeGreaterThan(1 / q);
        else {
          expect(average(group, 'agreementX')).toBeLessThan(1 / q);
          expect(average(group, 'agreementY')).toBeGreaterThan(1 / q);
        }
      }
      for (const key of [
        'agreement',
        'agreementX',
        'agreementY',
        'm0',
        'majority',
        'actionDensity',
      ])
        expect(
          Math.abs(average(groups[0]!, key) - average(groups[1]!, key)),
        ).toBeLessThan(0.035);
      console.info(
        JSON.stringify({
          pottsLarge: {
            q,
            scenario,
            seeds,
            warmup: 200,
            stride: 2,
            retainedPerSeed: N,
            attemptsPerSeed: 64 * (200 + 2 * N),
            metropolisAgreement: average(groups[0]!, 'agreement'),
            heatBathAgreement: average(groups[1]!, 'agreement'),
          },
        }),
      );
    }, 30000);
