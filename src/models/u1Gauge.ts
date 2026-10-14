import { gaugeGeometry, validateGaugeLoop } from '../domain/gaugeGeometry';
import type { GaugeGeometry } from '../domain/gaugeGeometry';
import type { Face } from '../domain/graph';

export type Phase = { re: number; im: number };
export type U1GaugeModel = ReturnType<typeof u1GaugeModel>;
const TAU = 2 * Math.PI;

/** Canonical [-π,π) representative; use circularDifference near the branch cut. */
export function wrapAngle(angle: number): number {
  if (!Number.isFinite(angle)) throw new Error('An angle must be finite.');
  const reduced = angle % TAU;
  const wrapped =
    reduced >= Math.PI
      ? reduced - TAU
      : reduced < -Math.PI
        ? reduced + TAU
        : reduced;
  return wrapped === 0 ? 0 : wrapped;
}
export function circularDifference(a: number, b: number): number {
  return wrapAngle(a - b);
}
export function phase(angle: number): Phase {
  const canonical = wrapAngle(angle);
  return { re: Math.cos(canonical), im: Math.sin(canonical) };
}
export function multiplyPhase(a: Phase, b: Phase): Phase {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
export function conjugatePhase(a: Phase): Phase {
  return { re: a.re, im: -a.im };
}
export function u1GaugeModel(geometry: GaugeGeometry, K: number) {
  if (!Number.isFinite(K) || Math.abs(K) > 4)
    throw new Error('Use finite K in [−4, 4].');
  const cell = gaugeGeometry(geometry);
  // Integer signed incidence, not Z₂ odd-occurrence parity. Opposite traversals
  // cancel; a repeated forward traversal would carry coefficient two.
  const incidence = cell.domain.faces.map((f) =>
    cell.domain.edges.map((e) =>
      f.boundary.reduce(
        (sum, occurrence) =>
          sum + (occurrence.edgeId === e.id ? occurrence.sign : 0),
        0,
      ),
    ),
  );
  return { ...cell, K, incidence };
}
export function validateAngles(
  model: U1GaugeModel,
  angles: readonly number[],
): void {
  if (
    angles.length !== model.domain.edges.length ||
    angles.some((a) => !Number.isFinite(a) || a < -Math.PI || a >= Math.PI)
  )
    throw new Error(
      'Supply one finite canonical angle in [−π, π) per physical link.',
    );
}
export function linkPhases(
  model: U1GaugeModel,
  angles: readonly number[],
): Phase[] {
  validateAngles(model, angles);
  return angles.map(phase);
}
export function plaquetteAngles(
  model: U1GaugeModel,
  angles: readonly number[],
): number[] {
  validateAngles(model, angles);
  return model.incidence.map((row) =>
    wrapAngle(row.reduce((sum, c, e) => sum + c * angles[e]!, 0)),
  );
}
export function plaquettePhases(
  model: U1GaugeModel,
  angles: readonly number[],
): Phase[] {
  return plaquetteAngles(model, angles).map(phase);
}
export function wilsonAngle(
  model: U1GaugeModel,
  angles: readonly number[],
  boundary: Face['boundary'],
): number {
  validateAngles(model, angles);
  validateGaugeLoop(model.domain, boundary);
  return wrapAngle(
    boundary.reduce(
      (sum, e) => sum + e.sign * angles[model.edgeIndex.get(e.edgeId)!]!,
      0,
    ),
  );
}
export function wilsonPhase(
  model: U1GaugeModel,
  angles: readonly number[],
  boundary: Face['boundary'],
): Phase {
  return phase(wilsonAngle(model, angles, boundary));
}
/** S=-K Σ cos θ_f under product NORMALIZED Haar measure ∏dθ/(2π). */
export function u1Action(
  model: U1GaugeModel,
  angles: readonly number[],
): number {
  return (
    -model.K *
    plaquetteAngles(model, angles).reduce((sum, a) => sum + Math.cos(a), 0)
  );
}
export function u1LocalDifference(
  model: U1GaugeModel,
  angles: readonly number[],
  edgeId: string,
  displacement: number,
): number {
  const e = model.edgeIndex.get(edgeId);
  if (e === undefined || !Number.isFinite(displacement))
    throw new Error('Invalid link or displacement.');
  const delta = wrapAngle(displacement);
  return (
    -model.K *
    plaquetteAngles(model, angles).reduce((sum, a, f) => {
      const c = model.incidence[f]![e]!;
      return sum + (c ? Math.cos(a + c * delta) - Math.cos(a) : 0);
    }, 0)
  );
}
/** ∂S/∂θ_e = K Σ_f c_fe sin θ_f. No compact-gauge HMC is exposed. */
export function u1Gradient(
  model: U1GaugeModel,
  angles: readonly number[],
): number[] {
  const faces = plaquetteAngles(model, angles);
  return angles.map(
    (_, e) =>
      model.K *
      faces.reduce(
        (sum, a, f) => sum + model.incidence[f]![e]! * Math.sin(a),
        0,
      ),
  );
}
/** θ_vw → θ_vw + α_v − α_w. Missing vertices have α=0; no RNG or state mutation. */
export function u1GaugeTransform(
  model: U1GaugeModel,
  angles: readonly number[],
  vertexPhases: Readonly<Record<string, number>>,
): number[] {
  validateAngles(model, angles);
  for (const [id, alpha] of Object.entries(vertexPhases))
    if (
      !model.domain.vertices.some((v) => v.id === id) ||
      !Number.isFinite(alpha)
    )
      throw new Error('Use existing vertices and finite phases.');
  return model.domain.edges.map((e, i) =>
    wrapAngle(
      angles[i]! +
        wrapAngle(vertexPhases[e.tail] ?? 0) -
        wrapAngle(vertexPhases[e.head] ?? 0),
    ),
  );
}
export function u1Observables(
  model: U1GaugeModel,
  angles: readonly number[],
): Record<string, number> {
  const faces = plaquettePhases(model, angles);
  const meanPlaquette = faces.reduce((sum, p) => sum + p.re, 0) / faces.length;
  const values: Record<string, number> = {
    meanPlaquette,
    action: -model.K * faces.length * meanPlaquette,
  };
  for (const loop of model.loops) {
    const p = wilsonPhase(model, angles, loop.boundary);
    values[`${loop.id}.re`] = p.re;
    values[`${loop.id}.im`] = p.im;
  }
  return values;
}
