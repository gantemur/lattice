import { expect, it } from 'vitest';
import { GaugeRun, defaultGauge } from './z2GaugeRun';
import { analyticGauge } from '../models/z2GaugeExact';
// Multiple seeds, moderate |K| and fixed budgets chosen before inspecting results.
// These are aggregate distribution checks, not autocorrelation-free MC error bars.
for (const geometry of ['square', 'torus'] as const)
  for (const sampler of ['direct', 'metropolis'] as const)
    for (const K of [-0.7, 0, 0.7])
      it(`${geometry} ${sampler} K=${K} equilibrium ensemble`, () => {
        const totals: Record<string, number> = {},
          winding = [0, 0, 0, 0];
        let n = 0;
        for (const seed of [17, 271, 12345, 89231]) {
          const run = new GaugeRun({
            ...defaultGauge,
            geometry,
            sampler,
            K,
            seed,
            warmup: 200,
            stride: 2,
          });
          const E = geometry === 'torus' ? 8 : 4;
          const budget = sampler === 'direct' ? 12000 : (200 + 12000 * 2) * E;
          for (let left = budget; left > 0; left -= Math.min(100000, left))
            run.advance(Math.min(100000, left));
          const s = run.snapshot().segments[0]!;
          n += s.samples;
          Object.entries(s.moments).forEach(
            ([key, m]) => (totals[key] = (totals[key] ?? 0) + m.mean * m.count),
          );
          s.winding.forEach((count, i) => (winding[i]! += count));
        }
        const a = analyticGauge(geometry, K),
          tol = sampler === 'direct' ? 0.025 : 0.045;
        expect(totals.meanPlaquette! / n).toBeCloseTo(a.meanPlaquette, 1);
        expect(
          Math.abs(totals.meanPlaquette! / n - a.meanPlaquette),
        ).toBeLessThan(tol);
        expect(Math.abs(totals.action! / n - a.action)).toBeLessThan(
          tol * 4 * Math.max(1, Math.abs(K)),
        );
        if (geometry === 'torus') {
          expect(Math.abs(totals.pair! / n - a.pair!)).toBeLessThan(tol);
          expect(Math.abs(totals.wx! / n)).toBeLessThan(tol);
          expect(Math.abs(totals.wy! / n)).toBeLessThan(tol);
          winding.forEach((count) =>
            expect(Math.abs(count / n - 0.25)).toBeLessThan(tol),
          );
        }
        console.info(
          `gauge benchmark ${geometry} ${sampler} K=${K}: n=${n}, meanP=${totals.meanPlaquette! / n}, action=${totals.action! / n}, winding=${winding.map((x) => x / n).join(',')}`,
        );
      }, 30000);
