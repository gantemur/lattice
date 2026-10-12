import { expect, it } from 'vitest';
import { scalarPreset } from '../models/scalarField';
import {
  decodeScalarConfiguration,
  encodeScalarConfiguration,
} from './shareConfiguration';
it('round trips only a versioned scalar configuration with graph, sampler and seed', () => {
  const c = {
    model: scalarPreset('four-quartic'),
    sampler: { kind: 'metropolis' as const, width: 0.7, warmup: 23 },
    seed: 42,
  };
  const url = encodeScalarConfiguration(
    c,
    'https://gantemur.github.io/lattice/#small-systems',
  );
  expect(url).toContain('/lattice/?config=');
  expect(decodeScalarConfiguration(url)).toEqual(c);
  expect(url).not.toContain('trajectory');
  expect(url).not.toContain('measurements');
});
it('rejects bad versions and nonnormalizable or incompatible imports', () => {
  const base = 'https://gantemur.github.io/lattice/';
  expect(() => decodeScalarConfiguration(base)).toThrow();
  const c = {
    model: scalarPreset('baseline'),
    sampler: { kind: 'direct' as const },
    seed: 1,
  };
  const url = new URL(encodeScalarConfiguration(c, base));
  const v = JSON.parse(url.searchParams.get('config')!);
  url.searchParams.set('config', '{malformed');
  expect(() => decodeScalarConfiguration(url.toString())).toThrow(
    /Invalid configuration JSON/,
  );
  v.version = 9;
  url.searchParams.set('config', JSON.stringify(v));
  expect(() => decodeScalarConfiguration(url.toString())).toThrow(/version/);
  v.version = 1;
  v.model.parameters.a.v0 = -1;
  url.searchParams.set('config', JSON.stringify(v));
  expect(() => decodeScalarConfiguration(url.toString())).toThrow(
    /normalizability/,
  );
  v.model = scalarPreset('double-well');
  url.searchParams.set('config', JSON.stringify(v));
  expect(() => decodeScalarConfiguration(url.toString())).toThrow(
    /Direct sampling/,
  );
});
