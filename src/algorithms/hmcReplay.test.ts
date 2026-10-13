import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRng } from './rng';
import { hmcQuarticTransition } from './quarticHmc';
import { FieldRun, defaultPhi4Configuration } from '../engine/fieldRun';
import { quarticQuadraticPart } from '../models/quarticOscillator';

// Captured from released main 14ae50c before sharing any HMC arithmetic.
// Decimal JSON literals round-trip to the same doubles; equality is exact.
function releasedResults() {
  const fixtures = [
    {
      parameters: { sites: 4, beta: 4, r: -2, lambda: 1, h: 0.3 },
      field: [0.3, -0.2, 0.7, -0.5],
      stepSize: 0.1,
      leapfrogSteps: 12,
    },
    {
      parameters: { sites: 4, beta: 2, r: 16, lambda: 4, h: 0 },
      field: [0, 0, 0, 0],
      stepSize: 0.25,
      leapfrogSteps: 32,
    },
    {
      parameters: { sites: 4, beta: 4, r: -2, lambda: 1, h: 0.3 },
      field: [1e30, 0, 0, 0],
      stepSize: 0.25,
      leapfrogSteps: 32,
    },
  ];
  const transitions = fixtures.map(
    ({ parameters, field: initial, stepSize, leapfrogSteps }) => {
      const source = createRng(12345);
      let draws = 0;
      let field = initial;
      const rng = {
        uniform: () => {
          draws++;
          return source.uniform();
        },
      };
      const records = [];
      for (let i = 0; i < 4; i++) {
        const result = hmcQuarticTransition(
          parameters,
          field,
          { kind: 'hmc', stepSize, leapfrogSteps },
          rng,
        );
        records.push({ ...result, draws });
        field = result.field;
      }
      return records;
    },
  );
  const p = fixtures[0]!.parameters;
  const run = new FieldRun(1, {
    model: 'quartic-oscillator',
    quartic: p,
    parameters: quarticQuadraticPart(p),
    sampler: { kind: 'hmc', stepSize: 0.1, leapfrogSteps: 12 },
    warmupTrajectories: 2,
    strideTrajectories: 3,
    seed: 12345,
  });
  run.advance(32);
  run.advance(15);
  const local = new FieldRun(1, {
    ...defaultPhi4Configuration,
    warmupSweeps: 0,
  });
  local.advance(128);
  // Pin all worker aggregates and bounded histories as well as visible traces.
  const hash = (value: unknown) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return {
    transitions,
    qmSnapshotHash: hash(run.snapshot()),
    spatialLocalHash: hash(local.snapshot()),
  };
}
it('exactly preserves released QM HMC outputs, draw counts and complete worker snapshots', () => {
  const actual = releasedResults();
  const fixture = new URL('./fixtures/releasedHmc.json', import.meta.url);
  expect(actual).toEqual(JSON.parse(readFileSync(fixture, 'utf8')));
});
