export type Moments = { count: number; mean: number; m2: number };

export function emptyMoments(): Moments {
  return { count: 0, mean: 0, m2: 0 };
}

/** Welford accumulation. Only the engine decides which samples to retain. */
export function recordMoment(moments: Moments, value: number): void {
  moments.count += 1;
  const delta = value - moments.mean;
  moments.mean += delta / moments.count;
  moments.m2 += delta * (value - moments.mean);
}

export function summarizeMoments({ count, mean, m2 }: Moments) {
  return {
    count,
    mean: count ? mean : null,
    variance: count > 1 ? m2 / (count - 1) : null,
    secondMoment: count ? m2 / count + mean * mean : null,
  };
}
