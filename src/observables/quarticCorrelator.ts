import {
  assessSampledGap,
  minimumEffectiveGapPaths,
  segmentCorrelator,
} from './oscillatorCorrelator';

/** The exact h=0 mean vanishes by reflection symmetry, even when one finite
 * Monte Carlo segment happens to stay in one well. Never demean each path. */
export function quarticCorrelationProjection(
  pairProducts: readonly (readonly number[])[],
  sampleMean: number | null,
  h: number,
) {
  const raw = segmentCorrelator(pairProducts);
  if (h === 0)
    return {
      raw,
      connected: raw,
      meanForCentering: 0,
      centering: 'symmetry' as const,
    };
  if (sampleMean === null || !Number.isFinite(sampleMean))
    return {
      raw,
      connected: null,
      meanForCentering: null,
      centering: 'unavailable' as const,
    };
  return {
    raw,
    connected: raw.map((value) => value - sampleMean * sampleMean),
    meanForCentering: sampleMean,
    centering: 'sample-plug-in' as const,
  };
}

/** Presentation gate, not a statistical confidence statement. A near-zero
 * connected denominator can be entirely subtraction roundoff or sampling
 * cancellation; it cannot support an arcosh energy indicator. */
export function quarticEffectiveEnergy(
  projection: ReturnType<typeof quarticCorrelationProjection> | null,
  measurements: number,
  lag: number,
  a: number,
  sites: number,
) {
  if (measurements < minimumEffectiveGapPaths)
    return { status: 'insufficient-samples' as const, value: null };
  if (!projection?.connected)
    return { status: 'unavailable-centering' as const, value: null };
  if (projection.centering === 'sample-plug-in') {
    const center = projection.connected[lag];
    const scale = Math.max(
      1,
      Math.abs(projection.raw[0]!),
      projection.meanForCentering! ** 2,
    );
    if (center !== undefined && Math.abs(center) <= 1e-10 * scale)
      return { status: 'cancellation-sensitive' as const, value: null };
  }
  return assessSampledGap(projection.connected, measurements, lag, a, sites);
}
