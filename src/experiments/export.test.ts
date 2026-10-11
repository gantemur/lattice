import { describe, expect, it } from 'vitest';
import { SimulationRun } from '../engine/simulationEngine';
import { ScalarRun } from '../engine/scalarRun';
import { LatticeRun } from '../engine/latticeRun';
import { defaultLatticeConfiguration } from '../engine/latticeRun';
import { defaultModel } from '../models/singleVariable';
import { scalarPreset } from '../models/scalarField';
import { createArchiveEntry, exportBundle, importBundle } from './archive';
import { csvCell, exportMeasurementsCsv, exportSummaryCsv } from './export';

function summary(entry: ReturnType<typeof createArchiveEntry>) {
  const [header, row] = exportSummaryCsv([entry]).trimEnd().split('\r\n');
  return Object.fromEntries(
    header!.split(',').map((key, i) => [key, row!.split(',')[i] ?? '']),
  );
}
function small(kind: 'gaussian' | 'spin' | 'binomial' | 'ising' | 'scalar') {
  const model =
    kind === 'scalar' ? scalarPreset('baseline') : defaultModel(kind);
  const configuration = {
    model,
    sampler: { kind: 'direct' as const },
    seed: 921,
  };
  const run =
    kind === 'scalar'
      ? new ScalarRun(1, configuration)
      : new SimulationRun(1, configuration);
  run.advance(80);
  return run.capture(1);
}

describe('portable CSV summaries', () => {
  it.each(['gaussian', 'spin', 'binomial', 'ising', 'scalar'] as const)(
    'exports %s primary moments from the originating worker',
    (kind) => {
      const capture = small(kind);
      const row = summary(createArchiveEntry(capture, 'g', kind));
      const expectedId =
        kind === 'gaussian'
          ? 'x'
          : kind === 'spin'
            ? 's'
            : kind === 'binomial'
              ? 'K'
              : kind === 'ising'
                ? 'M'
                : capture.segment.model.kind === 'scalar'
                  ? capture.segment.model.parameters.domain.vertices[0]!.id
                  : '';
      expect(row.primary_observable_id).toBe(expectedId);
      expect(row.primary_observable_unit).toBe(
        kind === 'binomial'
          ? 'count'
          : kind === 'scalar'
            ? 'real scalar'
            : kind === 'spin' || kind === 'ising'
              ? 'spin'
              : 'dimensionless',
      );
      expect(Number(row.primary_mean)).toBe(capture.segment.moments.mean);
      expect(Number(row.primary_sample_variance_n_minus_1)).toBe(
        capture.segment.moments.variance,
      );
      expect(row.mean_e_physical_per_site).toBe('');
      if (kind === 'ising') {
        const s = capture.segment;
        expect(Number(row.mean_E_dimensionless_action)).toBe(
          s.ising!.observables.E!.moments.mean,
        );
        expect(
          Number(row.sample_variance_E_dimensionless_action_n_minus_1),
        ).toBe(s.ising!.observables.E!.moments.variance);
        expect(Number(row.mean_abs_m)).toBe(
          s.ising!.observables.absM!.moments.mean! /
            (s.model.kind === 'ising'
              ? s.model.parameters.domain.vertices.length
              : 1),
        );
      } else expect(row.mean_E_dimensionless_action).toBe('');
      if (kind === 'scalar') {
        expect(Number(row.mean_S_dimensionless_action)).toBe(
          capture.segment.scalar!.targets.S!.moments.mean,
        );
        expect(
          Number(row.sample_variance_S_dimensionless_action_n_minus_1),
        ).toBe(capture.segment.scalar!.targets.S!.moments.variance);
      } else expect(row.mean_S_dimensionless_action).toBe('');
    },
  );

  it('uses the selected scalar observable and keeps sampled S separate', () => {
    const model = scalarPreset('baseline');
    const first = model.parameters.domain.vertices[0]!.id;
    model.observable = `${first}²`;
    const run = new ScalarRun(1, {
      model,
      sampler: { kind: 'direct' },
      seed: 67,
    });
    run.advance(40);
    const capture = run.capture(1);
    const row = summary(createArchiveEntry(capture, 'g', 'selected'));
    expect(row.primary_observable_id).toBe(`${first}²`);
    expect(row.primary_observable_unit).toBe('real scalar²');
    expect(Number(row.primary_mean)).toBe(
      capture.segment.scalar!.targets[`${first}²`]!.moments.mean,
    );
    expect(Number(row.primary_sample_variance_n_minus_1)).toBe(
      capture.segment.scalar!.targets[`${first}²`]!.moments.variance,
    );
    expect(Number(row.mean_S_dimensionless_action)).toBe(
      capture.segment.scalar!.targets.S!.moments.mean,
    );
  });

  it('keeps physical lattice energy variance distinct from equilibrium heat capacity', () => {
    const run = new LatticeRun(1, {
      ...defaultLatticeConfiguration,
      parameters: {
        ...defaultLatticeConfiguration.parameters,
        lx: 2,
        ly: 2,
        temperature: 2.5,
      },
      warmupSweeps: 0,
      strideSweeps: 1,
      seed: 67,
    });
    run.advance(4 * 40);
    const capture = run.capture(1);
    const s = capture.segment;
    const row = summary(createArchiveEntry(capture, 'g', 'lattice'));
    expect(row.primary_observable_id).toBe('m');
    expect(row.primary_observable_unit).toBe('spin/site');
    expect(Number(row.primary_mean)).toBe(s.m.mean);
    expect(Number(row.primary_sample_variance_n_minus_1)).toBe(s.m.variance);
    expect(Number(row.mean_e_physical_per_site)).toBe(s.e.mean);
    expect(Number(row.sample_variance_e_physical_per_site_n_minus_1)).toBe(
      s.e.variance,
    );
    expect(Number(row.heat_capacity_per_site)).toBe(
      s.fluctuations!.specificHeat,
    );
    expect(row.mean_E_dimensionless_action).toBe('');
    expect(row.mean_S_dimensionless_action).toBe('');
  });

  it('reports N−1 variance and only available post-warm-up raw transitions', () => {
    const run = new SimulationRun(1, {
      model: defaultModel('gaussian'),
      sampler: { kind: 'metropolis', width: 1, warmup: 10 },
      seed: 42,
    });
    run.advance(30);
    const capture = run.capture(1);
    const row = summary(createArchiveEntry(capture, 'g', 'warmup'));
    const values = capture.segment.trajectory
      .filter((transition) => !transition.warmup)
      .map((transition) => transition.result);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const sampleVariance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (values.length - 1);
    expect(Number(row.primary_sample_variance_n_minus_1)).toBeCloseTo(
      sampleVariance,
      12,
    );
    expect(row.raw_observations).toBe('20');
    expect(row.measurements).toBe('20');
  });

  it('neutralizes formula-like imported text while retaining CSV quoting and numeric signs', () => {
    const entry = createArchiveEntry(small('gaussian'), 'g', 'safe');
    const bundle = JSON.parse(exportBundle([entry]));
    bundle.records[0].scientific.datasetId = '+SUM(A1:A2)';
    bundle.records[0].annotation.name =
      '=HYPERLINK("https://example.test", "open")';
    const imported = importBundle([], JSON.stringify(bundle))[0]!;
    const csv = exportSummaryCsv([imported]);
    expect(csv).toContain("'+SUM(A1:A2)");
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"", ""open"")"');
    expect(exportMeasurementsCsv([imported])).toContain("'+SUM(A1:A2)");
    expect(csvCell(' \t@SUM(1)')).toBe('"\' \t@SUM(1)"');
    expect(csvCell('\r\n-1+2')).toBe('"\'\r\n-1+2"');
    expect(csvCell('\u0000=2+2')).toBe('"\'\u0000=2+2"');
    expect(csvCell('="quoted",\nnext')).toBe('"\'=""quoted"",\nnext"');
    expect(csvCell(-3.5)).toBe('-3.5');
    expect(csvCell(0.125)).toBe('0.125');
  });
});
