import { xyDomain, validateXYCoupling } from '../domain/xyDomain';
import type { XYDomain, XYGeometrySettings } from '../domain/xyDomain';
import { xyPlaquettes } from '../domain/xyPlaquettes';
import type { XYPlaquette } from '../domain/xyPlaquettes';
export type XYParameters = { h: number; geometry: XYGeometrySettings };
export type XYModel = XYDomain & { h: number; faces: XYPlaquette[] };
export type XYState = ArrayLike<number>;
export const TAU = 2 * Math.PI;
/** Half-open representatives. In particular +π maps to −π. Reverse bond
 * traversal must NEGATE a previously wrapped increment, not wrap it again. */
export function wrapXY(angle: number): number {
  if (!Number.isFinite(angle)) throw new Error('XY angles must be finite.');
  const wrapped = ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return wrapped === 0 ? 0 : wrapped;
}
export function xyModel(p: XYParameters): XYModel {
  validateXYCoupling(p.h);
  const domain = xyDomain(p.geometry);
  return { ...domain, h: p.h, faces: xyPlaquettes(domain) };
}
export function validateXYState(model: XYModel, state: XYState): void {
  if (state.length !== model.size)
    throw new Error('One XY angle per site required.');
  for (let i = 0; i < state.length; i++)
    if (
      !Number.isFinite(state[i]) ||
      state[i]! < -Math.PI ||
      state[i]! >= Math.PI
    )
      throw new Error('XY angles must be canonical in [−π,π).');
}
function checkSite(model: XYModel, state: XYState, site: number) {
  if (
    state.length !== model.size ||
    !Number.isInteger(site) ||
    site < 0 ||
    site >= model.size
  )
    throw new Error('Invalid XY site or state length.');
}
export function xySpin(theta: number) {
  return { x: Math.cos(theta), y: Math.sin(theta) };
}
/** Normalized Haar ∏dθ/(2π), S=−Σ K cos(θhead−θtail)−hΣcosθ.
 * Self-links contribute −K; each parallel physical record contributes once. */
export function xyAction(model: XYModel, state: XYState): number {
  validateXYState(model, state);
  let action = 0;
  for (let i = 0; i < model.size; i++) action -= model.h * Math.cos(state[i]!);
  for (const b of model.bonds)
    action -= b.K * Math.cos(state[b.head]! - state[b.tail]!);
  return action;
}
/** Local field sums NON-self incidences. The engine validates its complete
 * state on initialization; local kernels only need the chosen neighborhood. */
export function xyConditional(model: XYModel, state: XYState, site: number) {
  checkSite(model, state, site);
  let hx = model.h,
    hy = 0;
  const contributions = model.incident[site]!.map(({ bond, neighbor }) => {
    const b = model.bonds[bond]!,
      angle = state[neighbor]!;
    const x = b.K * Math.cos(angle),
      y = b.K * Math.sin(angle);
    hx += x;
    hy += y;
    return { bond: b.id, neighbor, angle, K: b.K, x, y };
  });
  const R = Math.hypot(hx, hy);
  return { hx, hy, R, mu: R === 0 ? null : Math.atan2(hy, hx), contributions };
}
export function xyDifference(
  model: XYModel,
  state: XYState,
  site: number,
  proposed: number,
): number {
  checkSite(model, state, site);
  if (!Number.isFinite(proposed)) throw new Error('Invalid proposed angle.');
  const old = state[site]!;
  let difference = -model.h * (Math.cos(proposed) - Math.cos(old));
  for (const { bond, neighbor } of model.incident[site]!)
    difference -=
      model.bonds[bond]!.K *
      (Math.cos(proposed - state[neighbor]!) -
        Math.cos(old - state[neighbor]!));
  return difference === 0 ? 0 : difference;
}
export function xyGradient(model: XYModel, state: XYState): number[] {
  validateXYState(model, state);
  const gradient = Array.from(state, (a) => model.h * Math.sin(a));
  for (const b of model.bonds) {
    if (b.tail === b.head) continue;
    const force = b.K * Math.sin(state[b.tail]! - state[b.head]!);
    gradient[b.tail]! += force;
    gradient[b.head]! -= force;
  }
  return gradient;
}
export function rotateXY(state: XYState, alpha: number): Float64Array {
  if (!Number.isFinite(alpha) || Math.abs(alpha) > 1e6)
    throw new Error('Use a finite rotation |α|≤10⁶ radians.');
  return Float64Array.from(state, (a) => wrapXY(a + alpha));
}
export function xyObservables(
  model: XYModel,
  state: XYState,
): Record<string, number> {
  const action = xyAction(model, state);
  let mx = 0,
    my = 0;
  for (let i = 0; i < model.size; i++) {
    mx += Math.cos(state[i]!);
    my += Math.sin(state[i]!);
  }
  mx /= model.size;
  my /= model.size;
  const values: Record<string, number> = {
    mx,
    my,
    mAbs: Math.hypot(mx, my),
    action,
    actionDensity: action / model.size,
  };
  for (const [axis, key] of [
    [undefined, 'bondCosine'],
    [0, 'bondX'],
    [1, 'bondY'],
  ] as const) {
    const bonds = model.bonds.filter(
      (b) => axis === undefined || b.axis === axis,
    );
    if (bonds.length)
      values[key] =
        bonds.reduce(
          (sum, b) => sum + Math.cos(state[b.head]! - state[b.tail]!),
          0,
        ) / bonds.length;
  }
  return values;
}
export function xySpatial(model: XYModel, state: XYState, axis: 0 | 1) {
  if (!model.shape) return [];
  const { lx, ly, periodicX, periodicY } = model.shape;
  const length = axis === 0 ? lx : ly,
    periodic = axis === 0 ? periodicX : periodicY;
  return Array.from({ length: Math.min(8, length - 1) + 1 }, (_, r) => {
    let sum = 0,
      pairs = 0;
    for (let y = 0; y < ly; y++)
      for (let x = 0; x < lx; x++) {
        const dx = axis === 0 ? r : 0,
          dy = axis === 1 ? r : 0;
        if (!periodic && (x + dx >= lx || y + dy >= ly)) continue;
        sum += Math.cos(
          state[((x + dx) % lx) + lx * ((y + dy) % ly)]! - state[x + lx * y]!,
        );
        pairs++;
      }
    return { r, pairs, cosine: sum / pairs };
  });
}
