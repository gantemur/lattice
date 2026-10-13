import { describe, expect, it } from 'vitest';
import {
  defaultQuarticOscillator,
  potentialMinimum,
  potentialStationaryPoints,
  quarticLocalDifference,
  quarticPathAction,
  quarticPotential,
  symmetricDoubleWell,
  validateQuarticOscillator,
} from './quarticOscillator';
import type { QuarticOscillatorParameters } from './quarticOscillator';

const physical = (changes: Partial<QuarticOscillatorParameters> = {}) => ({
  ...defaultQuarticOscillator,
  ...changes,
});

/** Independent direct four-site formula, including the closing 3→0 bond. */
function directAction(p: QuarticOscillatorParameters, x: number[]) {
  const a = p.beta / p.sites;
  let sum = 0;
  for (let j = 0; j < x.length; j++) {
    const next = x[(j + 1) % x.length]!;
    sum += (next - x[j]!) ** 2 / (2 * a);
    sum +=
      a * ((p.r * x[j]! ** 2) / 2 + (p.lambda * x[j]! ** 4) / 4 - p.h * x[j]!);
  }
  return sum;
}

describe('periodic interacting path action', () => {
  it('has four independent values and one closing kinetic bond', () => {
    const p = physical({ sites: 4, beta: 4, r: -2, lambda: 1, h: 0.4 });
    const path = [1, 0, -1, 2];
    expect(quarticPathAction(p, path)).toBeCloseTo(directAction(p, path), 13);
    expect(() => quarticPathAction(p, [...path, path[0]!])).toThrow();
    // This single-site change touches both the closing and first bonds.
    const proposed = -0.25;
    const changed = [...path];
    changed[0] = proposed;
    expect(quarticLocalDifference(p, path, 0, proposed)).toBeCloseTo(
      directAction(p, changed) - directAction(p, path),
      13,
    );
  });

  it.each([
    physical({ sites: 4, beta: 2, h: 0.3 }),
    physical({ sites: 9, beta: 16, r: 1, lambda: 1, h: -0.6 }),
    physical({ sites: 6, beta: 3, r: 1, lambda: 0, h: 0.8 }),
    physical({ sites: 16, beta: 8, r: -4, lambda: 0.05, h: 2 }),
  ])('agrees with two full actions for every site', (p) => {
    const path = Array.from(
      { length: p.sites },
      (_, j) => 0.2 * Math.sin(1.7 * j) - 0.1 * j,
    );
    for (let site = 0; site < p.sites; site++) {
      const proposed = path[site]! + 0.37 - 0.02 * site;
      const changed = [...path];
      changed[site] = proposed;
      expect(quarticLocalDifference(p, path, site, proposed)).toBeCloseTo(
        quarticPathAction(p, changed) - quarticPathAction(p, path),
        11,
      );
    }
  });

  it('rejects unsupported, nonfinite and overflowing inputs', () => {
    for (const changes of [
      { lambda: 0, r: 0 },
      { lambda: 0, r: -1 },
      { lambda: 0.001 },
      { lambda: Infinity },
      { beta: NaN },
      { h: 3 },
      { sites: 3 },
    ])
      expect(() => validateQuarticOscillator(physical(changes))).toThrow();
    expect(() => quarticPathAction(physical(), [Infinity])).toThrow();
    expect(() =>
      quarticLocalDifference(physical(), Array(16).fill(0), 0, 1e100),
    ).toThrow();
  });
});

describe('stationary potential geometry', () => {
  it('finds two symmetric minima and their classical barrier', () => {
    const p = physical();
    const points = potentialStationaryPoints(p);
    expect(points.map((point) => point.kind)).toEqual([
      'minimum',
      'maximum',
      'minimum',
    ]);
    expect(points[0]!.x).toBeCloseTo(-Math.SQRT2, 12);
    expect(points[1]!.x).toBeCloseTo(0, 12);
    expect(points[2]!.x).toBeCloseTo(Math.SQRT2, 12);
    expect(potentialMinimum(p).value).toBeCloseTo(-1, 12);
    expect(symmetricDoubleWell(p)?.barrier).toBeCloseTo(1, 12);
  });

  it('selects the deeper tilted well and the displaced Gaussian minimum', () => {
    const tilted = physical({ h: 0.4 });
    const minimum = potentialMinimum(tilted);
    expect(minimum.x).toBeGreaterThan(0);
    expect(minimum.value).toBeLessThan(quarticPotential(tilted, -Math.SQRT2));
    expect(symmetricDoubleWell(tilted)).toBeNull();
    const gaussian = physical({ r: 2, lambda: 0, h: 1 });
    expect(potentialMinimum(gaussian).x).toBeCloseTo(0.5, 12);
    expect(potentialMinimum(gaussian).value).toBeCloseTo(-0.25, 12);
  });
});
