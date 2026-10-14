import { expect, it } from 'vitest';
import { metropolisU1 } from './u1GaugeSampler';
import { createRng } from './rng';
import { u1Action, u1GaugeModel, wrapAngle } from '../models/u1Gauge';

it('three ordered draws, full two-face ΔS, acceptance and rejection', () => {
  const m = u1GaugeModel('torus', 1),
    before = Array<number>(8).fill(0);
  for (const decision of [0.01, 0.99]) {
    const draws = [0.8, 0.9, decision];
    let count = 0;
    const t = metropolisU1(m, before, 1, { uniform: () => draws[count++]! });
    expect(count).toBe(3);
    expect(t.uniforms).toEqual(draws);
    expect(t.edgeId).toBe('e6');
    expect(t.displacement).toBe(0.8);
    expect(t.proposedDelta).toBeCloseTo(2 * (1 - Math.cos(0.8)), 13);
    expect(t.kind).toBe(decision < t.probability ? 'accepted' : 'rejected');
    expect(t.actualDelta).toBeCloseTo(
      u1Action(m, t.angles) - u1Action(m, before),
      13,
    );
    if (t.kind === 'rejected') expect(t.angles).toEqual(before);
  }
  expect(before).toEqual(Array(8).fill(0));
});
it('downhill branch-crossing proposal still draws its decision; bad width draws nothing', () => {
  const m = u1GaugeModel('square', 1),
    before = [3.1, 0, 0, 0];
  let count = 0;
  const draws = [0.01, 0.9, 0.999];
  const t = metropolisU1(m, before, 0.8, { uniform: () => draws[count++]! });
  expect(count).toBe(3);
  expect(t.kind).toBe('accepted');
  expect(t.proposedDelta).toBeLessThan(0);
  expect(t.angles[0]).toBe(wrapAngle(3.1 + 0.64));
  for (const width of [0, 0.019, Math.PI + 0.001, NaN])
    expect(() =>
      metropolisU1(m, before, width, {
        uniform: () => {
          throw new Error('must not draw');
        },
      }),
    ).toThrow('width');
});
for (const geometry of ['square', 'torus'] as const)
  it(`${geometry}: continuous detailed balance against independent full actions`, () => {
    for (const K of [-4, -0.7, 0, 0.7, 4]) {
      const m = u1GaugeModel(geometry, K),
        width = 0.8;
      const fullAction = (angles: number[]) =>
        -K *
        m.domain.faces.reduce(
          (sum, f) =>
            sum +
            Math.cos(
              f.boundary.reduce(
                (angle, e) =>
                  angle + e.sign * angles[Number(e.edgeId.slice(1))]!,
                0,
              ),
            ),
          0,
        );
      for (let fixture = 0; fixture < 30; fixture++) {
        const angles = m.domain.edges.map((_, i) =>
          wrapAngle(Math.sin(fixture + i) * 4),
        );
        const e = fixture % angles.length,
          displacementU = (fixture + 0.5) / 30;
        const uniforms = [(e + 0.5) / angles.length, displacementU, 0];
        let at = 0;
        const forward = metropolisU1(m, angles, width, {
          uniform: () => uniforms[at++]!,
        });
        const reverseUniforms = [uniforms[0]!, 1 - displacementU, 0];
        at = 0;
        const backward = metropolisU1(m, forward.angles, width, {
          uniform: () => reverseUniforms[at++]!,
        });
        const proposalDensity = 1 / (angles.length * 2 * width);
        expect(
          Math.exp(-fullAction(angles)) * proposalDensity * forward.probability,
        ).toBeCloseTo(
          Math.exp(-fullAction(forward.angles)) *
            proposalDensity *
            backward.probability,
          7,
        );
        angles.forEach((angle, i) =>
          expect(wrapAngle(angle - backward.angles[i]!)).toBeCloseTo(0, 12),
        );
      }
    }
  });
it('same seeded kernel replays exactly', () => {
  const m = u1GaugeModel('torus', -0.7),
    a = createRng(12345),
    b = createRng(12345);
  let x = Array<number>(8).fill(0),
    y = [...x];
  for (let i = 0; i < 300; i++) {
    const t = metropolisU1(m, x, 0.8, a),
      u = metropolisU1(m, y, 0.8, b);
    expect(t).toEqual(u);
    x = t.angles;
    y = u.angles;
  }
});

it('independent open Gibbs fixture is invariant under one angular transition', () => {
  // Haar three links + rejection-drawn von Mises plaquette; solve e3 from
  // θ_f=θ0+θ2−θ3−θ1. This fixture never uses a production reference or sampler.
  const rng = createRng(90871),
    m = u1GaugeModel('square', 0.7);
  let beforeCos = 0,
    afterCos = 0,
    afterSin = 0;
  const count = 20000;
  for (let i = 0; i < count; i++) {
    const angles = Array.from(
      { length: 3 },
      () => 2 * Math.PI * rng.uniform() - Math.PI,
    );
    let face: number;
    do {
      face = 2 * Math.PI * rng.uniform() - Math.PI;
    } while (rng.uniform() > Math.exp(0.7 * (Math.cos(face) - 1)));
    angles.push(wrapAngle(angles[0]! + angles[2]! - angles[1]! - face));
    beforeCos += Math.cos(face);
    const updated = metropolisU1(m, angles, 0.8, rng).angles;
    const newFace = updated[0]! + updated[2]! - updated[3]! - updated[1]!;
    afterCos += Math.cos(newFace);
    afterSin += Math.sin(newFace);
  }
  expect(Math.abs(beforeCos / count - 0.330177289532671)).toBeLessThan(0.025);
  expect(Math.abs(afterCos / count - 0.330177289532671)).toBeLessThan(0.025);
  expect(Math.abs(afterSin / count)).toBeLessThan(0.025);
});
