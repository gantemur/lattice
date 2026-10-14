import type { Rng } from './rng';
import {
  u1LocalDifference,
  validateAngles,
  wrapAngle,
} from '../models/u1Gauge';
import type { U1GaugeModel } from '../models/u1Gauge';

export type U1Transition = {
  kind: 'accepted' | 'rejected';
  angles: number[];
  edgeId: string;
  before: number;
  proposed: number;
  displacement: number;
  proposedDelta: number;
  actualDelta: number;
  probability: number;
  uniforms: number[];
};
export function validateU1Width(width: number): void {
  if (!Number.isFinite(width) || width < 0.02 || width > Math.PI)
    throw new Error('Use angular proposal half-width 0.02–π radians.');
}
/** Uniform link and symmetric circular displacement: proposal densities cancel
 * in detailed balance. Exactly THREE draws: link, displacement, decision,
 * including downhill/rejected proposals. There is no artificial lazy stay. */
export function metropolisU1(
  model: U1GaugeModel,
  before: readonly number[],
  width: number,
  rng: Rng,
): U1Transition {
  validateAngles(model, before);
  validateU1Width(width);
  const uniforms = [rng.uniform(), rng.uniform(), rng.uniform()];
  const index = Math.floor(uniforms[0]! * before.length);
  const edgeId = model.domain.edges[index]!.id;
  const displacement = width * (2 * uniforms[1]! - 1);
  const proposed = wrapAngle(before[index]! + displacement);
  const proposedDelta = u1LocalDifference(model, before, edgeId, displacement);
  const probability = Math.exp(Math.min(0, -proposedDelta));
  const kind = uniforms[2]! < probability ? 'accepted' : 'rejected';
  const angles = [...before];
  if (kind === 'accepted') angles[index] = proposed;
  return {
    kind,
    angles,
    edgeId,
    before: before[index]!,
    proposed,
    displacement,
    proposedDelta,
    actualDelta: kind === 'accepted' ? proposedDelta : 0,
    probability,
    uniforms,
  };
}
