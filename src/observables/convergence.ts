export type Checkpoint = { count: number; mean: number };
// ceil(1.125 n) needs fewer than 314 checkpoints up to MAX_SAFE_INTEGER.
export const MAX_CHECKPOINTS = 320;
export class ConvergenceHistory {
  private points: Checkpoint[] = [];
  private next = 1;
  private latest: Checkpoint | null = null;

  record(count: number, mean: number): void {
    this.latest = { count, mean };
    if (count === this.next) {
      this.points.push(this.latest);
      this.next = Math.ceil(count * 1.125);
    }
  }

  snapshot(): Checkpoint[] {
    const points = this.points.map((point) => ({ ...point }));
    if (this.latest && this.latest.count !== points.at(-1)?.count)
      points.push({ ...this.latest });
    return points;
  }
}

/** Known-variance standard error for independent Gaussian draws, not MCMC. */
export function gaussianStandardError(variance: number, count: number): number {
  if (
    !(variance > 0) ||
    !Number.isFinite(variance) ||
    !Number.isSafeInteger(count) ||
    count < 1
  )
    throw new Error(
      'Standard error needs positive variance and a positive sample count.',
    );
  return Math.sqrt(variance / count);
}
