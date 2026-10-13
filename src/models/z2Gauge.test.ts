import { describe, expect, it } from 'vitest';
import {
  gaugeAction,
  gaugeFlipDifference,
  gaugeModel,
  gaugeObservables,
  gaugeState,
  gaugeTransform,
  plaquettes,
  validateGaugeLoop,
  validateLinks,
  wilsonProduct,
} from './z2Gauge';
import { analyticGauge, exactGauge } from './z2GaugeExact';

for (const geometry of ['square', 'torus'] as const)
  describe(geometry, () => {
    const model = gaugeModel(geometry, 0.7),
      E = model.domain.edges.length;
    it('keeps physical links and oriented closed faces distinct', () => {
      expect(model.domain.vertices).toHaveLength(4);
      expect(E).toBe(geometry === 'square' ? 4 : 8);
      expect(model.domain.faces).toHaveLength(geometry === 'square' ? 1 : 4);
      expect(new Set(model.domain.edges.map((e) => e.id)).size).toBe(E);
      expect(model.domain.edges.filter((e) => e.wraps)).toHaveLength(
        geometry === 'square' ? 0 : 4,
      );
      model.loops.forEach((l) =>
        expect(() => validateGaugeLoop(model.domain, l.boundary)).not.toThrow(),
      );
      expect(() =>
        validateGaugeLoop(model.domain, [{ edgeId: 'e0', sign: 1 }]),
      ).toThrow();
      expect(() =>
        validateGaugeLoop(model.domain, [{ edgeId: 'missing', sign: 1 }]),
      ).toThrow();
      expect(() => validateLinks(model, [0])).toThrow();
      const state = gaugeState(model, 1); // e0=-1; others +1.
      expect(plaquettes(model, state)).toEqual(
        geometry === 'square' ? [-1] : [-1, 1, -1, 1],
      );
      expect(gaugeAction(model, state)).toBeCloseTo(
        geometry === 'square' ? 0.7 : 0,
      );
    });
    it('exhaustively verifies action differences and all 16 gauge assignments', () => {
      for (let code = 0; code < 2 ** E; code++) {
        const links = gaugeState(model, code),
          p = plaquettes(model, links);
        expect(gaugeAction(model, links)).toBeCloseTo(
          -0.7 * p.reduce((s, x) => s + x, 0),
        );
        if (geometry === 'torus') expect(p.reduce((a, b) => a * b, 1)).toBe(1);
        model.domain.edges.forEach((edge, i) => {
          const flipped = [...links];
          flipped[i]! *= -1;
          expect(gaugeFlipDifference(model, links, edge.id)).toBeCloseTo(
            gaugeAction(model, flipped) - gaugeAction(model, links),
          );
          expect(
            plaquettes(model, flipped).filter((v, j) => v !== p[j]),
          ).toHaveLength(geometry === 'square' ? 1 : 2);
        });
        for (let g = 0; g < 16; g++) {
          const vertices = model.domain.vertices
            .filter((_, i) => g & (1 << i))
            .map((v) => v.id);
          const transformed = gaugeTransform(model, links, vertices);
          expect(gaugeObservables(model, transformed)).toEqual(
            gaugeObservables(model, links),
          );
          expect(gaugeTransform(model, transformed, vertices)).toEqual(links);
          if (g === 15) expect(transformed).toEqual(links);
        }
        for (const loop of model.loops) {
          const reversed = [...loop.boundary]
            .reverse()
            .map((e) => ({ ...e, sign: -e.sign as 1 | -1 }));
          expect(wilsonProduct(model, links, reversed)).toBe(
            wilsonProduct(model, links, loop.boundary),
          );
        }
        if (geometry === 'torus') {
          const o = gaugeObservables(model, links);
          expect(o.pair).toBe(p[0]! * p[1]!);
          expect(o.wx).toBe(links[0]! * links[2]!);
          expect(o.wy).toBe(links[1]! * links[5]!);
          // The parallel row representative differs by the enclosed flux.
          expect(links[4]! * links[6]!).toBe(o.wx! * o.pair!);
        }
      }
    });
    it('counts plaquette multiplicities and gauge orbits independently', () => {
      const patterns = new Map<string, number>(),
        orbits = new Set<string>(),
        invariants = new Set<string>();
      for (let code = 0; code < 2 ** E; code++) {
        const state = gaugeState(model, code),
          p = plaquettes(model, state).join(',');
        patterns.set(p, (patterns.get(p) ?? 0) + 1);
        const orbit = new Set(
          Array.from({ length: 16 }, (_, g) =>
            gaugeTransform(
              model,
              state,
              model.domain.vertices
                .filter((_, i) => g & (1 << i))
                .map((v) => v.id),
            ).join(','),
          ),
        );
        expect(orbit.size).toBe(8);
        orbits.add([...orbit].sort()[0]!);
        const o = gaugeObservables(model, state);
        invariants.add(`${p}/${o.wx ?? ''}/${o.wy ?? ''}`);
      }
      expect(patterns.size).toBe(geometry === 'square' ? 2 : 8);
      expect([...patterns.values()]).toEqual(
        Array(patterns.size).fill(geometry === 'square' ? 8 : 32),
      );
      expect(orbits.size).toBe(geometry === 'square' ? 2 : 32);
      expect(invariants.size).toBe(orbits.size);
    });
    for (const K of [-4, -0.7, 0, 0.7, 4])
      it(`matches independent analytical references at K=${K}`, () => {
        const m = gaugeModel(geometry, K),
          r = exactGauge(m),
          a = analyticGauge(geometry, K);
        expect(r.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        expect(r.logZ).toBeCloseTo(a.logZ, 12);
        expect(r.means.meanPlaquette).toBeCloseTo(a.meanPlaquette, 12);
        expect(r.means.action).toBeCloseTo(a.action, 12);
        m.domain.faces.forEach((f) =>
          expect(r.means[f.id]).toBeCloseTo(a.meanPlaquette, 12),
        );
        if (geometry === 'torus') {
          for (let i = 0; i < 4; i++)
            for (let j = i + 1; j < 4; j++) {
              const pair = r.states.reduce(
                (sum, state, k) =>
                  sum +
                  plaquettes(m, state)[i]! *
                    plaquettes(m, state)[j]! *
                    r.probabilities[k]!,
                0,
              );
              expect(pair).toBeCloseTo(a.pair!, 12);
            }
          expect(r.means.wx).toBeCloseTo(0, 12);
          expect(r.means.wy).toBeCloseTo(0, 12);
          r.winding.forEach((p) => expect(p).toBeCloseTo(0.25, 12));
        }
      });
  });
it('rejects unsupported topology and invalid coupling before construction', () => {
  expect(() => gaugeModel('ring' as 'square', 1)).toThrow();
  for (const K of [NaN, Infinity, 4.01, -4.01])
    expect(() => gaugeModel('torus', K)).toThrow();
});
