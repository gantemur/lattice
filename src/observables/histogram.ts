export type Histogram = {
  min: number;
  max: number;
  bins: number[];
  below: number;
  above: number;
};

// A fixed-range histogram preserves every recorded sample in a bin or an
// explicit tail counter; plotting code must include tails in normalization.

export function createHistogram(
  min: number,
  max: number,
  binCount = 32,
): Histogram {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max ||
    !Number.isInteger(binCount) ||
    binCount < 1
  ) {
    throw new Error(
      'Histogram requires finite increasing bounds and a positive integer bin count.',
    );
  }
  return {
    min,
    max,
    bins: Array<number>(binCount).fill(0),
    below: 0,
    above: 0,
  };
}

export function recordHistogram(histogram: Histogram, value: number): void {
  if (!Number.isFinite(value))
    throw new Error('Cannot record a non-finite sample.');
  if (value < histogram.min) histogram.below += 1;
  else if (value >= histogram.max) histogram.above += 1;
  else {
    const index = Math.min(
      histogram.bins.length - 1,
      Math.floor(
        ((value - histogram.min) / (histogram.max - histogram.min)) *
          histogram.bins.length,
      ),
    );
    histogram.bins[index] = (histogram.bins[index] ?? 0) + 1;
  }
}
