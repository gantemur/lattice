import type { RealSiteVariable } from '../domain/singleSite';

export type GaussianParameters = Readonly<{ a: number; h: number }>;

export const gaussianVariable: RealSiteVariable = {
  id: 'x',
  carrier: 'vertex',
  carrierId: 'v0',
  kind: 'real',
};

// A deliberately bounded teaching range, not the mathematical domain of all Gaussians.
export function validateGaussian({ a, h }: GaussianParameters): void {
  if (!Number.isFinite(a) || a < 0.05 || a > 20) {
    throw new Error(
      'Use a quadratic coefficient a between 0.05 and 20 (a must be positive).',
    );
  }
  if (!Number.isFinite(h) || Math.abs(h) > 10) {
    throw new Error('Use a finite source h between −10 and 10.');
  }
}

// Dimensionless action; the target is exp(-S), with no additional beta.
export function gaussianAction(
  x: number,
  { a, h }: GaussianParameters,
): number {
  return (a * x * x) / 2 - h * x;
}

export function gaussianReference(parameters: GaussianParameters) {
  validateGaussian(parameters);
  const { a, h } = parameters;
  const mean = h / a;
  const variance = 1 / a;
  return {
    mean,
    variance,
    secondMoment: variance + mean * mean,
    standardDeviation: Math.sqrt(variance),
    // Keeping Z in log space also covers large source/small a safely.
    logPartition: 0.5 * Math.log((2 * Math.PI) / a) + (h * h) / (2 * a),
  };
}

export function gaussianDensity(
  x: number,
  parameters: GaussianParameters,
): number {
  const mean = parameters.h / parameters.a;
  const z = Math.sqrt(parameters.a) * (x - mean);
  return Math.sqrt(parameters.a / (2 * Math.PI)) * Math.exp(-0.5 * z * z);
}
