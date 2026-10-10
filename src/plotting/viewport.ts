import type { SegmentSnapshot } from '../engine/protocol';
import { gaussianDensity, gaussianReference } from '../models/gaussian';
import { gaussianStandardError } from '../observables/convergence';
export type Range = { min: number; max: number };
export type PlotViewport = {
  density: Range & { yMax: number };
  mean: Range;
  error: Range;
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
    nMax = 2;
  for (const segment of segments) {
    const {
      mean,
      variance,
      standardDeviation: sd,
    } = gaussianReference(segment.parameters);
    const { histogram, moments, convergence } = segment;
    xMin = Math.min(xMin, histogram.min);
    xMax = Math.max(xMax, histogram.max);
    const binWidth = (histogram.max - histogram.min) / histogram.bins.length;
    densityMax = Math.max(
      densityMax,
      gaussianDensity(mean, segment.parameters),
      ...histogram.bins.map((n) =>
        moments.count ? n / (moments.count * binWidth) : 0,
      ),
    );
    meanMin = Math.min(meanMin, mean - sd);
    meanMax = Math.max(meanMax, mean + sd);
    errorMax = Math.max(errorMax, sd);
    errorMin = Math.min(errorMin, sd / Math.sqrt(Math.max(2, moments.count)));
    nMax = Math.max(nMax, moments.count);
    for (const point of convergence) {
      const se = gaussianStandardError(variance, point.count);
      meanMin = Math.min(meanMin, point.mean, mean - se);
      meanMax = Math.max(meanMax, point.mean, mean + se);
      const error = Math.abs(point.mean - mean);
      if (error > 0) errorMin = Math.min(errorMin, error);
      errorMax = Math.max(errorMax, error);
    }
  }
  return {
    density: { min: xMin, max: xMax, yMax: densityMax * 1.1 },
    mean: {
      min: meanMin - (meanMax - meanMin) * 0.05,
      max: meanMax + (meanMax - meanMin) * 0.05,
    },
    error: { min: errorMin / 1.25, max: errorMax * 1.25 },
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
