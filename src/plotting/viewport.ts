import type { SegmentSnapshot } from '../engine/protocol';
import { modelReference, probability, support } from '../models/singleVariable';
export type Range = { min: number; max: number };
export type PlotViewport = {
  density: Range & { yMax: number };
  mean: Range;
  error: Range;
  trajectory: Range;
  nMax: number;
};
export function fitSegments(segments: SegmentSnapshot[]): PlotViewport {
  let xMin = Infinity,
    xMax = -Infinity,
    densityMax = 0;
  let meanMin = Infinity,
    meanMax = -Infinity,
    errorMin = Infinity,
    errorMax = 0,
    nMax = 2,
    trajectoryMin = Infinity,
    trajectoryMax = -Infinity;
  for (const segment of segments) {
    const { mean, standardDeviation: sd } = modelReference(segment.model);
    const { histogram, moments, convergence, model } = segment;
    const discrete = model.kind !== 'gaussian',
      states = support(model);
    const min = model.kind === 'spin' ? -1.5 : histogram.min,
      max = model.kind === 'spin' ? 1.5 : histogram.max;
    xMin = Math.min(xMin, min);
    xMax = Math.max(xMax, max);
    const binWidth = discrete
      ? 1
      : (histogram.max - histogram.min) / histogram.bins.length;
    const exactMax = discrete
      ? Math.max(...states.map((s) => probability(model, s)))
      : probability(model, mean);
    densityMax = Math.max(
      densityMax,
      exactMax,
      ...histogram.bins.map((n) =>
        moments.count ? n / (moments.count * binWidth) : 0,
      ),
    );
    meanMin = Math.min(meanMin, mean - Math.max(sd, 0.1));
    meanMax = Math.max(meanMax, mean + Math.max(sd, 0.1));
    errorMax = Math.max(errorMax, sd, 0.1);
    errorMin = Math.min(
      errorMin,
      Math.max(sd, 1e-10) / Math.sqrt(Math.max(2, moments.count)),
    );
    nMax = Math.max(nMax, moments.count);
    for (const point of convergence) {
      meanMin = Math.min(meanMin, point.mean);
      meanMax = Math.max(meanMax, point.mean);
      const error = Math.abs(point.mean - mean);
      if (error > 0) errorMin = Math.min(errorMin, error);
      errorMax = Math.max(errorMax, error);
    }
    trajectoryMin = Math.min(
      trajectoryMin,
      discrete ? states[0]! : min,
      segment.initialValue ?? Infinity,
      ...segment.trajectory.map((t) => t.result),
    );
    trajectoryMax = Math.max(
      trajectoryMax,
      discrete ? states.at(-1)! : max,
      segment.initialValue ?? -Infinity,
      ...segment.trajectory.map((t) => t.result),
    );
  }
  return {
    density: { min: xMin, max: xMax, yMax: densityMax * 1.1 },
    mean: {
      min: meanMin - (meanMax - meanMin) * 0.05,
      max: meanMax + (meanMax - meanMin) * 0.05,
    },
    error: { min: errorMin / 1.25, max: errorMax * 1.25 },
    trajectory: { min: trajectoryMin, max: trajectoryMax },
    nMax,
  };
}
export function expandViewport(
  previous: PlotViewport,
  needed: PlotViewport,
): PlotViewport {
  const expand = (a: Range, b: Range) => ({
    min: Math.min(a.min, b.min),
    max: Math.max(a.max, b.max),
  });
  return {
    density: {
      ...expand(previous.density, needed.density),
      yMax: Math.max(previous.density.yMax, needed.density.yMax),
    },
    mean: expand(previous.mean, needed.mean),
    error: expand(previous.error, needed.error),
    trajectory: expand(previous.trajectory, needed.trajectory),
    nMax: Math.max(previous.nMax, needed.nMax),
  };
}
export function segmentColor(id: number): string {
  return [
    '#14625a',
    '#a25721',
    '#6250a3',
    '#ac3b59',
    '#3266ad',
    '#737127',
    '#8a492f',
    '#505866',
  ][(id - 1) % 8]!;
}
