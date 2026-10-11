import type { ArchiveEntry } from './archive';
import type { SegmentSnapshot } from '../engine/protocol';

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
  'primary_observable_id',
  'primary_observable_unit',
  'primary_mean',
  'primary_sample_variance_n_minus_1',
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
  'sample_variance_e_physical_per_site_n_minus_1',
  'mean_E_dimensionless_action',
  'sample_variance_E_dimensionless_action_n_minus_1',
  'mean_S_dimensionless_action',
  'sample_variance_S_dimensionless_action_n_minus_1',
  'susceptibility',
  'binder',
  'heat_capacity_per_site',
] as const;
export function csvCell(value: unknown): string {
  // Prefix text before RFC 4180 quoting: spreadsheet imports must not execute
  // formula-like names or IDs, even when whitespace/control characters lead.
  const original = value == null ? '' : String(value);
  const text =
    typeof value === 'string' && /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(value)
      ? `'${original}`
      : original;
  return /[",\u0000-\u001f\u007f]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
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
function smallPrimary(segment: SegmentSnapshot) {
  const { model } = segment;
  if (model.kind === 'gaussian')
    return { id: 'x', unit: 'dimensionless', moments: segment.moments };
  if (model.kind === 'spin')
    return { id: 's', unit: 'spin', moments: segment.moments };
  if (model.kind === 'binomial')
    return { id: 'K', unit: 'count', moments: segment.moments };
  if (model.kind === 'ising') {
    const id = model.observable ?? 'M';
    return {
      id,
      unit:
        id === 'm' ? 'spin/site' : id === 'E' ? 'dimensionless action' : 'spin',
      moments: segment.moments,
    };
  }
  const id = model.observable ?? model.parameters.domain.vertices[0]!.id;
  return {
    id,
    unit:
      id === 'S'
        ? 'dimensionless action'
        : id.endsWith('²') || id.includes('·')
          ? 'real scalar²'
          : 'real scalar',
    moments: segment.scalar?.targets[id]?.moments ?? segment.moments,
  };
}
export function exportSummaryCsv(entries: readonly ArchiveEntry[]): string {
  const rows = entries.map(({ scientific, annotation }) => {
    const { capture, datasetId, source } = scientific;
    const common = {
      dataset_id: datasetId,
      name: annotation.name,
      workspace: capture.workspace,
      model:
        capture.workspace === 'lattice'
          ? '2d-ising'
          : capture.segment.model.kind,
      segment_id: capture.segment.id,
      seed: source.seed,
    };
    let specific: Record<string, unknown>;
    if (capture.workspace === 'lattice') {
      const s = capture.segment;
      specific = {
        sampler: s.settings.sampler,
        measurements: s.samples,
        raw_observations: capture.diagnosticRecord.count,
        diagnostic_status: s.diagnostics.m.status,
        primary_observable_id: 'm',
        primary_observable_unit: 'spin/site',
        primary_mean: s.m.mean,
        primary_sample_variance_n_minus_1: s.m.variance,
        lx: s.settings.parameters.lx,
        ly: s.settings.parameters.ly,
        periodic_x: s.settings.parameters.periodicX,
        periodic_y: s.settings.parameters.periodicY,
        temperature: s.settings.parameters.temperature,
        jx: s.settings.parameters.jx,
        jy: s.settings.parameters.jy,
        field: s.settings.parameters.field,
        mean_m: s.m.mean,
        mean_abs_m: s.absM.mean,
        mean_e_physical_per_site: s.e.mean,
        sample_variance_e_physical_per_site_n_minus_1: s.e.variance,
        susceptibility: s.fluctuations?.susceptibility,
        binder: s.fluctuations?.binder,
        heat_capacity_per_site: s.fluctuations?.specificHeat,
      };
    } else {
      const s = capture.segment;
      const primary = smallPrimary(s);
      const graph = s.model.kind === 'ising' ? s.ising : null;
      const scalar = s.model.kind === 'scalar' ? s.scalar : null;
      const sites =
        s.model.kind === 'ising'
          ? s.model.parameters.domain.vertices.length
          : 1;
      const trajectory = scalar?.trajectory ?? s.trajectory;
      specific = {
        sampler: s.sampler.kind,
        measurements: s.moments.count,
        raw_observations:
          capture.diagnosticRecord?.count ??
          trajectory.filter((transition) => !transition.warmup).length,
        diagnostic_status: graph?.diagnostics.m.status,
        primary_observable_id: primary.id,
        primary_observable_unit: primary.unit,
        primary_mean: primary.moments.mean,
        primary_sample_variance_n_minus_1: primary.moments.variance,
        mean_m: graph?.observables.m?.moments.mean,
        mean_abs_m:
          graph?.observables.absM?.moments.mean == null
            ? null
            : graph.observables.absM.moments.mean / sites,
        mean_E_dimensionless_action: graph?.observables.E?.moments.mean,
        sample_variance_E_dimensionless_action_n_minus_1:
          graph?.observables.E?.moments.variance,
        mean_S_dimensionless_action: scalar?.targets.S?.moments.mean,
        sample_variance_S_dimensionless_action_n_minus_1:
          scalar?.targets.S?.moments.variance,
      };
    }
    const record: Record<string, unknown> = { ...common, ...specific };
    return SUMMARY_COLUMNS.map((column) => record[column] ?? null);
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
