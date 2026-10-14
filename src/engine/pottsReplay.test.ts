import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PottsRun } from './pottsRun';
import type { PottsConfiguration } from './pottsRun';
import type { PottsSampler } from '../algorithms/pottsSampler';
import { pottsGraph } from '../domain/pottsDomain';

// Captured from released M5c, 8b0bbdef, BEFORE cluster dispatch was introduced.
// Hash the complete public snapshots, including segmented aggregates, bounded
// history, traces, RNG counters, batch versions and a fresh seeded Reset replay.
const released: Record<string, string> = {
  'direct/false':
    'b1ad9b7c80c7856e13edf288513a752b7b7ea775d594adff78e0b640f3aceb3a',
  'direct/true':
    'cbdf81affa42c44c5eb151be7e4365a66f2a1f44838d3f37fafda925fa7b0a2a',
  'metropolis/false':
    'dbbd1a95f2b1696b089b16b6fb2d21b092ae09b61f3423ea73390072376478de',
  'metropolis/true':
    '48b75a85ee2fa85de5a8f1553016d6a1fab3dc7ab59576fe35344f1dcabfce0f',
  'heat-bath/false':
    '9ee920169777a9a6c9ace4a11ec8516c15f4b8b35216e858bbfdca1a4b78b565',
  'heat-bath/true':
    '5d3b5ae383240aaebeffd2d7a285231de1526df825ee3be04219dc11982c1684',
};
describe('released Potts worker replay', () => {
  for (const sampler of ['direct', 'metropolis', 'heat-bath'] as PottsSampler[])
    for (const rectangle of [false, true])
      it(`${sampler} ${rectangle ? 'rectangle' : 'graph'}`, () => {
        const configuration: PottsConfiguration = {
          parameters: {
            q: 3,
            h: 0.4,
            geometry: rectangle
              ? {
                  kind: 'lattice',
                  shape: { lx: 2, ly: 2, periodicX: true, periodicY: true },
                  kx: -0.3,
                  ky: 0.8,
                }
              : pottsGraph('torus', -0.3),
          },
          sampler,
          warmup: 2,
          stride: 2,
          seed: 12345,
        };
        const run = new PottsRun(configuration);
        const snapshots = [run.snapshot()];
        for (const count of [1, 7, 33]) {
          run.advance(count);
          snapshots.push(run.snapshot());
        }
        run.change({
          ...configuration,
          parameters: { ...configuration.parameters, h: -0.2 },
          warmup: 0,
          stride: 1,
        });
        snapshots.push(run.snapshot());
        for (const count of [5, 123, 1024]) {
          run.advance(count);
          snapshots.push(run.snapshot());
        }
        const reset = new PottsRun(configuration);
        reset.advance(34);
        snapshots.push(reset.snapshot());
        const hash = createHash('sha256')
          .update(JSON.stringify(snapshots))
          .digest('hex');
        const key = `${sampler}/${rectangle}`;

        expect(hash).toBe(released[key]);
      });
});
