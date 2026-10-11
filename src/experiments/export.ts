import type { ArchiveEntry } from './archive';

const MEASUREMENT_COLUMNS = [
  'dataset_id',
  'workspace',
  'model',
  'observable_id',
  'unit',
  'observation_index',
  'update',
  'nominal_sweep',
  'value',
  'source_record',
] as const;
const SUMMARY_COLUMNS = [
  'dataset_id',
  'name',
  'workspace',
  'model',
  'segment_id',
  'seed',
  'sampler',
  'measurements',
  'raw_observations',
  'diagnostic_status',
  'lx',
  'ly',
  'periodic_x',
  'periodic_y',
  'temperature',
  'jx',
  'jy',
  'field',
  'mean_m',
  'mean_abs_m',
  'mean_e_physical_per_site',
  'mean_E_dimensionless_action',
  'susceptibility',
  'binder',
  'heat_capacity_per_site',
] as const;
export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function measurementRows(entries: readonly ArchiveEntry[]): unknown[][] {
  const rows: unknown[][] = [];
  for (const { scientific } of entries) {
    const { capture, datasetId } = scientific;
    if (capture.diagnosticRecord) {
      const record = capture.diagnosticRecord;
      for (let i = 0; i < record.count; i++) {
        const index = record.firstMeasurement + i;
        const update =
          capture.workspace === 'lattice'
            ? capture.segment.startUpdate +
              capture.segment.settings.parameters.lx *
                capture.segment.settings.parameters.ly *
                (capture.segment.settings.warmupSweeps +
                  index * capture.segment.settings.strideSweeps)
            : capture.segment.startUpdate +
              capture.segment.warmupTarget +
              index;
        const sweep =
          capture.workspace === 'lattice'
            ? update /
              (capture.segment.settings.parameters.lx *
                capture.segment.settings.parameters.ly)
            : capture.segment.sampler.kind === 'direct' ||
                capture.segment.model.kind !== 'ising'
              ? null
              : (update - capture.segment.startUpdate) /
                capture.segment.model.parameters.domain.vertices.length;
        for (const [observable, unit, values] of [
          ['m', 'spin/site', record.m],
          ['abs_m', 'spin/site', record.absM],
          [
            capture.workspace === 'lattice' ? 'e' : 'E',
            capture.workspace === 'lattice'
              ? 'physical energy/site'
              : 'dimensionless action',
            record.e,
          ],
        ] as const)
          rows.push([
            datasetId,
            capture.workspace,
            capture.workspace === 'lattice'
              ? '2d-ising'
              : capture.segment.model.kind,
            observable,
            unit,
            index,
            update,
            sweep,
            values[i],
            'diagnostic-ring',
          ]);
      }
    } else if (capture.workspace === 'small') {
      const s = capture.segment;
      const model = s.model.kind;
      const trajectory =
        s.model.kind === 'scalar' ? (s.scalar?.trajectory ?? []) : s.trajectory;
      for (const t of trajectory) {
        if (t.warmup) continue;
        const index = t.segmentUpdate - s.warmupTarget;
        if (
          s.model.kind === 'scalar' &&
          'result' in t &&
          Array.isArray(t.result)
        ) {
          const result = t.result;
          s.model.parameters.domain.vertices.forEach((v, j) =>
            rows.push([
              datasetId,
              'small',
              model,
              v.id,
              'real scalar',
              index,
              t.update,
              null,
              result[j],
              'recent-trajectory',
            ]),
          );
        } else if ('result' in t && typeof t.result === 'number') {
          rows.push([
            datasetId,
            'small',
            model,
            s.model.kind === 'gaussian'
              ? 'x'
              : s.model.kind === 'spin'
                ? 's'
                : 'K',
            s.model.kind === 'binomial' ? 'count' : 'dimensionless',
            index,
            t.update,
            null,
            t.result,
            'recent-trajectory',
          ]);
        }
      }
    }
  }
  return rows;
}
export function exportMeasurementsCsv(
  entries: readonly ArchiveEntry[],
): string {
  return csv([[...MEASUREMENT_COLUMNS], ...measurementRows(entries)]);
}
export function exportSummaryCsv(entries: readonly ArchiveEntry[]): string {
  const rows = entries.map(({ scientific, annotation }) => {
    const { capture, datasetId, source } = scientific;
    if (capture.workspace === 'lattice') {
      const s = capture.segment;
      return [
        datasetId,
        annotation.name,
        'lattice',
        '2d-ising',
        s.id,
        source.seed,
        s.settings.sampler,
        s.samples,
        capture.diagnosticRecord.count,
        s.diagnostics.m.status,
        s.settings.parameters.lx,
        s.settings.parameters.ly,
        s.settings.parameters.periodicX,
        s.settings.parameters.periodicY,
        s.settings.parameters.temperature,
        s.settings.parameters.jx,
        s.settings.parameters.jy,
        s.settings.parameters.field,
        s.m.mean,
        s.absM.mean,
        s.e.mean,
        null,
        s.fluctuations?.susceptibility ?? null,
        s.fluctuations?.binder ?? null,
        s.fluctuations?.specificHeat ?? null,
      ];
    }
    const s = capture.segment;
    return [
      datasetId,
      annotation.name,
      'small',
      s.model.kind,
      s.id,
      source.seed,
      s.sampler.kind,
      s.moments.count,
      capture.diagnosticRecord?.count ??
        Math.min(
          s.moments.count,
          s.model.kind === 'scalar'
            ? (s.scalar?.trajectory.length ?? 0)
            : s.trajectory.length,
        ),
      s.ising?.diagnostics.m.status ?? '',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      s.ising?.observables.m?.moments.mean ?? null,
      s.ising?.observables.absM?.moments.mean ?? null,
      null,
      s.ising?.observables.E?.moments.mean ?? null,
      null,
      null,
      null,
    ];
  });
  return csv([[...SUMMARY_COLUMNS], ...rows]);
}
export function exportMeasurementMetadata(
  entries: readonly ArchiveEntry[],
): string {
  return JSON.stringify({
    format: 'lattice-lab-measurements-csv-sidecar',
    schemaVersion: 1,
    csvFile: 'lattice-measurements.csv',
    columns: [...MEASUREMENT_COLUMNS],
    coordinateConvention:
      'update is the global elementary-update index; nominal_sweep is present only where meaningful; observation_index is segment-local and 1-based',
    datasets: entries.map(({ scientific, annotation }) => ({
      datasetId: scientific.datasetId,
      name: annotation.name,
      source: scientific.source,
      settings:
        scientific.capture.workspace === 'lattice'
          ? scientific.capture.segment.settings
          : {
              model: scientific.capture.segment.model,
              sampler: scientific.capture.segment.sampler,
            },
      fullMeasurements:
        scientific.capture.workspace === 'lattice'
          ? scientific.capture.segment.samples
          : scientific.capture.segment.moments.count,
      rawCoverage: scientific.capture.diagnosticRecord
        ? {
            count: scientific.capture.diagnosticRecord.count,
            firstObservation:
              scientific.capture.diagnosticRecord.firstMeasurement,
          }
        : { kind: 'recent-transitions-only' },
    })),
  });
}
