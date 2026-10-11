import type { ArchiveEntry } from './archive';
import { csvCell, measurementRows } from './export';
import type { SavedSweep } from './sweepArchive';

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function sweepEntries(
  sweep: SavedSweep,
  entries: readonly ArchiveEntry[],
) {
  const ids = new Set(sweep.sourceRecordIds.map((source) => source.libraryId));
  return entries.filter((e) => ids.has(e.libraryId));
}
export function sweepPointEntry(
  sweep: SavedSweep,
  datasetId: string | null,
  entries: readonly ArchiveEntry[],
) {
  const source = sweep.sourceRecordIds.find(
    (record) => record.datasetId === datasetId,
  );
  return entries.find((entry) => entry.libraryId === source?.libraryId);
}
export function exportSweepMeasurementsCsv(
  sweep: SavedSweep,
  entries: readonly ArchiveEntry[],
) {
  const records = sweepEntries(sweep, entries);
  const index = new Map(
    sweep.scientific.points.map((p) => [p.datasetId, p.index]),
  );
  return csv([
    [
      'sweep_id',
      'point_index',
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
    ],
    ...measurementRows(records).map((row) => [
      sweep.scientific.sweepId,
      index.get(row[0] as string),
      ...row,
    ]),
  ]);
}
export function exportSweepSummaryCsv(
  sweep: SavedSweep,
  entries: readonly ArchiveEntry[],
) {
  const records = sweepEntries(sweep, entries);
  const byId = new Map(records.map((e) => [e.scientific.datasetId, e]));
  return csv([
    [
      'sweep_id',
      'name',
      'status',
      'point_index',
      'parameter',
      'parameter_value',
      'seed',
      'seed_rule',
      'sampler',
      'initialization',
      'lx',
      'ly',
      'periodic_x',
      'periodic_y',
      'temperature',
      'jx',
      'jy',
      'field',
      'warmup_sweeps',
      'stride_sweeps',
      'requested_updates',
      'actual_updates',
      'measurements',
      'dataset_id',
      'raw_m_abs_m_e_observations',
      'mean_m_spin_per_site',
      'mean_abs_m_spin_per_site',
      'mean_e_physical_per_site',
      'susceptibility',
      'binder',
      'heat_capacity_per_site',
      'gx',
      'gy',
      'diagnostic_m_status',
      'diagnostic_m_tau_nominal_sweeps',
      'diagnostic_m_ess',
      'diagnostic_m_recent_mean_se',
      'diagnostic_abs_m_status',
      'diagnostic_abs_m_tau_nominal_sweeps',
      'diagnostic_abs_m_ess',
      'diagnostic_abs_m_recent_mean_se',
      'diagnostic_e_status',
      'diagnostic_e_tau_nominal_sweeps',
      'diagnostic_e_ess',
      'diagnostic_e_recent_mean_se',
    ],
    ...sweep.scientific.points.map((p) => {
      const s = p.datasetId
        ? byId.get(p.datasetId)?.scientific.capture.segment
        : null;
      const lattice = s && 'settings' in s ? s : null;
      const params = p.parameters;
      const d = lattice?.diagnostics.m;
      return [
        sweep.scientific.sweepId,
        sweep.scientific.name,
        p.status,
        p.index,
        sweep.scientific.plan.varying,
        p.value,
        p.seed,
        sweep.scientific.plan.seedRule,
        sweep.scientific.plan.base.sampler,
        sweep.scientific.plan.base.initialization,
        params.lx,
        params.ly,
        params.periodicX,
        params.periodicY,
        params.temperature,
        params.jx,
        params.jy,
        params.field,
        sweep.scientific.plan.base.warmupSweeps,
        sweep.scientific.plan.base.strideSweeps,
        p.requestedUpdates,
        p.actualUpdates,
        p.measurements,
        p.datasetId,
        p.datasetId
          ? byId.get(p.datasetId)?.scientific.capture.diagnosticRecord?.count
          : null,
        lattice?.m.mean,
        lattice?.absM.mean,
        lattice?.e.mean,
        lattice?.fluctuations?.susceptibility,
        lattice?.fluctuations?.binder,
        lattice?.fluctuations?.specificHeat,
        lattice?.gx.mean,
        lattice?.gy.mean,
        d?.status,
        d?.tauSweeps,
        d?.ess,
        d?.standardError,
        lattice?.diagnostics.absM.status,
        lattice?.diagnostics.absM.tauSweeps,
        lattice?.diagnostics.absM.ess,
        lattice?.diagnostics.absM.standardError,
        lattice?.diagnostics.e.status,
        lattice?.diagnostics.e.tauSweeps,
        lattice?.diagnostics.e.ess,
        lattice?.diagnostics.e.standardError,
      ];
    }),
  ]);
}
