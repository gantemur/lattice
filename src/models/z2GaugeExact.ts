import { gaugeObservables, gaugeState } from './z2Gauge';
import type { GaugeModel } from './z2Gauge';

/** Stable finite sum over unfixed link variables, not gauge-orbit representatives. */
export function exactGauge(model: GaugeModel) {
  const states = Array.from(
    { length: 2 ** model.domain.edges.length },
    (_, i) => gaugeState(model, i),
  );
  const observations = states.map((state) => gaugeObservables(model, state));
  const logs = observations.map((o) => -o.action!);
  const maximum = Math.max(...logs);
  const weights = logs.map((x) => Math.exp(x - maximum));
  const total = weights.reduce((a, b) => a + b, 0);
  const probabilities = weights.map((w) => w / total);
  let cumulative = 0;
  const cdf = probabilities.map((p) => (cumulative += p));
  cdf[cdf.length - 1] = 1;
  const means = Object.fromEntries(
    Object.keys(observations[0]!).map((key) => [
      key,
      observations.reduce((s, o, i) => s + o[key]! * probabilities[i]!, 0),
    ]),
  );
  const winding = [0, 0, 0, 0];
  if (model.geometry === 'torus')
    observations.forEach((o, i) => {
      winding[(o.wx === 1 ? 2 : 0) + (o.wy === 1 ? 1 : 0)]! +=
        probabilities[i]!;
    });
  return {
    states,
    probabilities,
    cdf,
    logZ: maximum + Math.log(total),
    means,
    winding,
  };
}
/** Independent high-temperature expansion, t=tanh K; no enumeration calls. */
export function analyticGauge(geometry: 'square' | 'torus', K: number) {
  const t = Math.tanh(K),
    torus = geometry === 'torus';
  const meanPlaquette = torus ? (t + t ** 3) / (1 + t ** 4) : t;
  return {
    logZ: torus
      ? Math.log(256) + 4 * Math.log(Math.cosh(K)) + Math.log1p(t ** 4)
      : Math.log(16) + Math.log(Math.cosh(K)),
    meanPlaquette,
    action: -K * (torus ? 4 : 1) * meanPlaquette,
    pair: torus ? (2 * t * t) / (1 + t ** 4) : null,
    plusProbability: (1 + meanPlaquette) / 2,
  };
}
