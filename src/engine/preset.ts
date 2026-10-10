import type { RunConfiguration } from './protocol';

export const standardGaussianPreset = {
  id: 'standard-gaussian',
  version: 1,
  name: 'Standard Gaussian',
  configuration: {
    model: { kind: 'gaussian', parameters: { a: 1, h: 0 } },
    sampler: { kind: 'direct' },
    seed: 20261010,
  } satisfies RunConfiguration,
} as const;
