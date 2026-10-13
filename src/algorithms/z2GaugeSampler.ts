import type { Rng } from './rng';
import { gaugeAction, gaugeFlipDifference } from '../models/z2Gauge';
import type { GaugeModel } from '../models/z2Gauge';
import type { exactGauge } from '../models/z2GaugeExact';
export type GaugeTransition = {
  kind: 'direct' | 'self' | 'accepted' | 'rejected';
  links: number[];
  edgeId?: string;
  proposedDelta?: number;
  actualDelta: number;
  probability?: number;
  uniforms: number[];
};
export function directGauge(
  reference: ReturnType<typeof exactGauge>,
  rng: Rng,
  model: GaugeModel,
  before: readonly number[],
): GaugeTransition {
  const u = rng.uniform();
  const index = reference.cdf.findIndex((p) => u < p);
  const links = [...reference.states[index]!];
  return {
    kind: 'direct',
    links,
    actualDelta: gaugeAction(model, links) - gaugeAction(model, before),
    uniforms: [u],
  };
}
/** Exactly three uniforms even for lazy stays or downhill flips. One attempt is
 * algorithmic time; E attempts with replacement define one nominal sweep. */
export function metropolisGauge(
  model: GaugeModel,
  before: readonly number[],
  rng: Rng,
): GaugeTransition {
  const uniforms = [rng.uniform(), rng.uniform(), rng.uniform()];
  const index = Math.floor(uniforms[0]! * model.domain.edges.length);
  const edgeId = model.domain.edges[index]!.id;
  const proposedDelta = gaugeFlipDifference(model, before, edgeId);
  const probability = Math.exp(Math.min(0, -proposedDelta));
  const kind =
    uniforms[1]! < 0.5
      ? 'self'
      : uniforms[2]! < probability
        ? 'accepted'
        : 'rejected';
  const links = [...before];
  if (kind === 'accepted') links[index]! *= -1;
  return {
    kind,
    links,
    edgeId,
    proposedDelta,
    actualDelta: kind === 'accepted' ? proposedDelta : 0,
    probability,
    uniforms,
  };
}
