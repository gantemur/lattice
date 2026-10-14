import { expect, it } from 'vitest';
import { U1GaugeRun, defaultU1 } from './u1GaugeRun';
import { u1Reference } from '../models/u1GaugeReference';
import {
  multiplyPhase,
  plaquettePhases,
  u1GaugeModel,
} from '../models/u1Gauge';

// Budgets/tolerances declared before the ensemble is inspected. Local records
// are correlated: these broad regression gates are not MC confidence intervals.
const seeds = [17, 271, 12345, 89231];
for (const geometry of ['square', 'torus'] as const)
  for (const K of [-0.7, 0, 0.7])
    it(`${geometry} K=${K}: independent-seed equilibrium ensemble`, () => {
      const sums: Record<string, number> = {},
        histograms: Record<string, number[]> = {};
      const seedMeans: number[] = [];
      const E = geometry === 'torus' ? 8 : 4,
        samples = 12000,
        warmup = 200,
        stride = 4;
      const budget = (warmup + samples * stride) * E;
      for (const seed of seeds) {
        const run = new U1GaugeRun({
          ...defaultU1,
          geometry,
          K,
          seed,
          warmup,
          stride,
        });
        for (let left = budget; left > 0; left -= Math.min(10000, left))
          run.advance(Math.min(10000, left));
        const snapshot = run.snapshot(),
          s = snapshot.segments[0]!;
        expect(s.samples).toBe(samples);
        expect(snapshot.draws).toBe(3 * budget);
        seedMeans.push(s.moments.meanPlaquette!.mean);
        for (const [id, m] of Object.entries(s.moments))
          sums[id] = (sums[id] ?? 0) + m.mean / seeds.length;
        for (const [id, bins] of Object.entries(s.histograms)) {
          histograms[id] ??= Array<number>(bins.length).fill(0);
          bins.forEach(
            (count, i) =>
              (histograms[id]![i]! += count / (samples * seeds.length)),
          );
        }
        if (geometry === 'torus') {
          const m = u1GaugeModel(geometry, K);
          for (const h of s.history) {
            const product = plaquettePhases(m, h.angles).reduce(multiplyPhase, {
              re: 1,
              im: 0,
            });
            expect(product.re).toBeCloseTo(1, 12);
            expect(product.im).toBeCloseTo(0, 12);
          }
        }
      }
      const exact = u1Reference(geometry, K).values!;
      expect(Math.abs(sums.meanPlaquette! - exact.meanPlaquette)).toBeLessThan(
        0.045,
      );
      expect(Math.abs(sums.action! - exact.action)).toBeLessThan(
        0.045 * (geometry === 'torus' ? 4 : 1) * Math.max(1, Math.abs(K)),
      );
      for (const [id, value] of Object.entries(sums)) {
        if (id.endsWith('.im') || id.startsWith('w'))
          expect(Math.abs(value)).toBeLessThan(0.045);
        if (id.startsWith('f') && id.endsWith('.re'))
          expect(Math.abs(value - exact.meanPlaquette)).toBeLessThan(0.045);
      }
      if (geometry === 'torus') {
        expect(Math.abs(sums['pair.re']! - exact.pair!)).toBeLessThan(0.045);
        for (const id of ['wx', 'wy'])
          for (const probability of histograms[id]!)
            expect(Math.abs(probability - 1 / 24)).toBeLessThan(0.015);
      } else {
        // Independent bin integration, not a midpoint approximation to bin mass.
        for (let bin = 0; bin < 24; bin++) {
          let mass = 0;
          for (let k = 0; k < 128; k++) {
            const angle =
              -Math.PI + ((bin + (k + 0.5) / 128) * 2 * Math.PI) / 24;
            mass += Math.exp(K * Math.cos(angle)) / (exact.I0 * 24 * 128);
          }
          expect(Math.abs(histograms.f0![bin]! - mass)).toBeLessThan(0.015);
        }
      }
      console.info('U1 ensemble', {
        geometry,
        K,
        seeds,
        warmup,
        stride,
        updatesPerSeed: budget,
        samplesPerSeed: samples,
        seedMeans,
        means: sums,
        histograms,
      });
    }, 30000);
