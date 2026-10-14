import { expect, it } from 'vitest';
import { pottsGraph } from '../domain/pottsDomain';
import { pottsModel, pottsAction } from '../models/potts';
import { decodePotts, encodePotts, exactPotts } from '../models/pottsExact';
import { pottsTransition } from './pottsSampler';
import { isingTransition } from './isingTransition';
import { latticeTransition } from './latticeTransition';
import { createIndexedLattice } from '../domain/indexedLattice';
import type { IsingModel } from '../models/ising';
import { isingGraphPreset } from '../domain/graph';
function uniforms(values: number[]) {
  let used = 0;
  return {
    uniform: () => {
      if (used >= values.length) throw new Error('Extra RNG draw');
      return values[used++]!;
    },
    get used() {
      return used;
    },
  };
}
for (const q of [2, 3, 4] as const)
  for (const K of [-0.8, 0.7])
    for (const sampler of ['metropolis', 'heat-bath'] as const)
      it(`complete ${q}-color ${sampler} transition matrix, K=${K}`, () => {
        const model = pottsModel({
            q,
            h: 0.3,
            geometry: pottsGraph('triangle', K),
          }),
          exact = exactPotts(model),
          n = exact.states.length;
        const matrix = Array.from({ length: n }, () =>
          Array<number>(n).fill(0),
        );
        exact.states.forEach((state, row) => {
          for (let site = 0; site < model.size; site++) {
            // Independent conditional formed from complete candidate actions.
            const candidates = Array.from({ length: q }, (_, c) => {
              const s = state.slice();
              s[site] = c;
              return s;
            });
            const costs = candidates.map((s) => pottsAction(model, s)),
              weights = costs.map((s) => Math.exp(-s)),
              sum = weights.reduce((s, w) => s + w, 0);
            if (sampler === 'heat-bath') {
              const trace = pottsTransition(
                model,
                sampler,
                state.slice(),
                uniforms([(site + 0.5) / model.size, 0.2]),
              );
              candidates.forEach((s, c) => {
                const independent = weights[c]! / sum;
                expect(trace.conditional![c]).toBeCloseTo(independent, 13);
                matrix[row]![encodePotts(s, q)]! += independent / model.size;
              });
            } else {
              matrix[row]![row]! += 0.5 / model.size;
              let alternate = 0;
              for (let c = 0; c < q; c++)
                if (c !== state[site]) {
                  const proposal = 0.5 + (0.5 * (alternate++ + 0.5)) / (q - 1),
                    rng = uniforms([(site + 0.5) / model.size, proposal, 0]);
                  const trace = pottsTransition(
                    model,
                    sampler,
                    state.slice(),
                    rng,
                  );
                  expect(trace.proposed).toBe(c);
                  expect(rng.used).toBe(3);
                  const alpha = Math.min(
                    1,
                    Math.exp(exact.actions[row]! - costs[c]!),
                  );
                  expect(trace.probability).toBeCloseTo(alpha, 13);
                  matrix[row]![encodePotts(candidates[c]!, q)]! +=
                    alpha / (2 * (q - 1) * model.size);
                  matrix[row]![row]! +=
                    (1 - alpha) / (2 * (q - 1) * model.size);
                }
            }
          }
        });
        for (let i = 0; i < n; i++) {
          expect(matrix[i]!.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 13);
          expect(matrix[i]!.every((p) => p >= 0)).toBe(true);
          expect(matrix[i]![i]).toBeGreaterThan(0);
          if (sampler === 'metropolis')
            expect(matrix[i]![i]).toBeGreaterThanOrEqual(0.5 - 1e-14);
          let incoming = 0;
          for (let j = 0; j < n; j++) {
            expect(exact.probabilities[i]! * matrix[i]![j]!).toBeCloseTo(
              exact.probabilities[j]! * matrix[j]![i]!,
              13,
            );
            incoming += exact.probabilities[j]! * matrix[j]![i]!;
          }
          expect(incoming).toBeCloseTo(exact.probabilities[i]!, 13);
        }
        // Reachability under positive one-step probabilities independently verifies
        // irreducibility; positive diagonal probabilities establish aperiodicity.
        const seen = new Set([0]),
          queue = [0];
        for (let at = 0; at < queue.length; at++)
          for (let j = 0; j < n; j++)
            if (matrix[queue[at]!]![j]! > 0 && !seen.has(j)) {
              seen.add(j);
              queue.push(j);
            }
        expect(seen.size).toBe(n);
      });
it('distinguishes lazy stays, rejection, accepted recoloring and unchanged resampling with exact budgets', () => {
  const model = pottsModel({ q: 3, h: 4, geometry: pottsGraph('dimer', 4) });
  for (const [u, outcome] of [
    [[0.1, 0.1, 0.99], 'self'],
    [[0.1, 0.7, 0.99], 'rejected'],
    [[0.1, 0.7, 0], 'accepted'],
  ] as const) {
    const rng = uniforms([...u]),
      s = Uint8Array.of(0, 0),
      trace = pottsTransition(model, 'metropolis', s, rng);
    expect(trace.outcome).toBe(outcome);
    expect(rng.used).toBe(3);
    if (outcome !== 'accepted') expect(trace.actualDelta).toBe(0);
  }
  for (const v of [0.001, 0.99999]) {
    const rng = uniforms([0.1, v]),
      trace = pottsTransition(model, 'heat-bath', Uint8Array.of(0, 0), rng);
    expect(rng.used).toBe(2);
    expect(trace.outcome).toBe(v < 0.1 ? 'unchanged' : 'changed');
    expect(trace.probability).toBeNull();
  }
  const rng = uniforms([0.43]);
  expect(
    pottsTransition(model, 'direct', Uint8Array.of(0, 0), rng).outcome,
  ).toBe('draw');
  expect(rng.used).toBe(1);
});
for (const sampler of ['metropolis', 'heat-bath'] as const)
  it(`q=2 matches released graph/indexed ${sampler} injected uniforms`, () => {
    const domain = isingGraphPreset('torus'),
      couplings = Object.fromEntries(
        domain.edges.map((e) => [e.id, e.axis === 0 ? -0.8 : 1.1]),
      ),
      h = 0.6;
    const p = pottsModel({
      q: 2,
      h,
      geometry: { kind: 'graph', domain, couplings },
    });
    const ising: IsingModel = {
      kind: 'ising',
      parameters: {
        domain,
        couplings: Object.fromEntries(
          Object.entries(couplings).map(([id, k]) => [id, k / 2]),
        ),
        fields: Object.fromEntries(domain.vertices.map((v) => [v.id, h / 2])),
      },
    };
    const parameters = {
        lx: 2,
        ly: 2,
        periodicX: true,
        periodicY: true,
        jx: -0.4,
        jy: 0.55,
        field: 0.3,
        temperature: 1,
      },
      lattice = createIndexedLattice(parameters);
    for (let code = 0; code < 16; code++)
      for (const siteU of [0.05, 0.3, 0.55, 0.8])
        for (const proposal of [0.1, 0.7])
          for (const decision of [0.1, 0.9]) {
            const colors = decodePotts(code, 4, 2),
              bits = 15 - code,
              values =
                sampler === 'metropolis'
                  ? [siteU, proposal, decision]
                  : [siteU, decision];
            const spins = Int8Array.from(colors, (c) => (c === 0 ? 1 : -1));
            const a = pottsTransition(p, sampler, colors, uniforms(values)),
              b = isingTransition(
                ising,
                sampler === 'metropolis'
                  ? { kind: sampler, width: 1, warmup: 0 }
                  : { kind: sampler },
                bits,
                uniforms(values),
              ),
              c = latticeTransition(
                lattice,
                parameters,
                sampler,
                spins,
                uniforms(values),
                1,
              );
            expect(Array.from(colors, (x) => (x === 0 ? 1 : -1))).toEqual(
              Array.from(spins),
            );
            expect(encodePotts(colors, 2)).toBe(15 - b.result);
            expect(a.actualDelta).toBeCloseTo(c.deltaS, 12);
            if (sampler === 'heat-bath')
              expect(a.conditional![0]).toBeCloseTo(c.probability, 13);
          }
  });
