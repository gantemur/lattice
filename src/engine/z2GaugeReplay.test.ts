import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { GaugeRun, defaultGauge } from './z2GaugeRun';

// Captured from released M5a before extracting shared oriented geometry.
it('preserves the released Z₂ full-snapshot replay', () => {
  const snapshots = [];
  for (const geometry of ['square', 'torus'] as const)
    for (const sampler of ['direct', 'metropolis'] as const) {
      const run = new GaugeRun({ ...defaultGauge, geometry, sampler });
      run.advance(301);
      run.transform('v2');
      run.change({ ...defaultGauge, geometry, sampler, K: -0.7 });
      run.advance(127);
      snapshots.push(run.snapshot());
    }
  const hash = createHash('sha256')
    .update(JSON.stringify(snapshots))
    .digest('hex');
  expect(hash).toBe(
    '20bf8dd21391b1b69cd52921115d984f6de17b507e5b9bbe4551c58ad5f1b8b0',
  );
});
