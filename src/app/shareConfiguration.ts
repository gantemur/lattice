import type { RunConfiguration } from '../engine/protocol';
import { validateSettings } from '../algorithms/transitions';
import { validateSeed } from '../algorithms/rng';
export const SCALAR_SHARE_VERSION = 1;
export function encodeScalarConfiguration(
  configuration: RunConfiguration,
  base: string,
): string {
  if (configuration.model.kind !== 'scalar')
    throw new Error('Only real scalar configurations are shared here.');
  validateSettings(configuration);
  validateSeed(configuration.seed);
  const url = new URL(base);
  url.searchParams.set(
    'config',
    JSON.stringify({
      version: SCALAR_SHARE_VERSION,
      model: configuration.model,
      sampler: configuration.sampler,
      seed: configuration.seed,
    }),
  );
  return url.toString();
}
export function decodeScalarConfiguration(input: string): RunConfiguration {
  const url = new URL(
      input,
      typeof location === 'undefined'
        ? 'https://example.invalid/lattice/'
        : location.href,
    ),
    raw = url.searchParams.get('config');
  if (!raw) throw new Error('No scalar configuration in this link.');
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Invalid configuration JSON.');
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('version' in payload) ||
    payload.version !== SCALAR_SHARE_VERSION
  )
    throw new Error('Unsupported scalar configuration schema version.');
  const candidate = payload as RunConfiguration & { version: number };
  if (candidate.model?.kind !== 'scalar')
    throw new Error('This link is not a real scalar configuration.');
  validateSeed(candidate.seed);
  validateSettings(candidate);
  return {
    model: candidate.model,
    sampler: candidate.sampler,
    seed: candidate.seed,
  };
}
