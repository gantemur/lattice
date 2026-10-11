import { useRef, useState } from 'react';
import type { ArchiveEntry } from '../experiments/archive';
import {
  exportBundle,
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_RECORDS,
  renameEntry,
} from '../experiments/archive';
import {
  exportMeasurementMetadata,
  exportMeasurementsCsv,
  exportSummaryCsv,
} from '../experiments/export';
import { commonDescriptors, descriptors } from '../experiments/comparison';
import { formatNumber } from '../plotting/PlotFrame';
import { SweepWorkspace } from './SweepWorkspace';
import type { SavedSweep } from '../experiments/sweepArchive';
import { importPortableBundle } from '../experiments/sweepArchive';

function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function sampleCount(entry: ArchiveEntry) {
  const c = entry.scientific.capture;
  return c.workspace === 'lattice'
    ? c.segment.samples
    : c.segment.moments.count;
}
function modelName(entry: ArchiveEntry) {
  const c = entry.scientific.capture;
  return c.workspace === 'lattice' ? '2D Ising' : c.segment.model.kind;
}
function principalParameters(entry: ArchiveEntry) {
  const c = entry.scientific.capture;
  if (c.workspace === 'lattice') {
    const p = c.segment.settings.parameters;
    return `${p.lx}×${p.ly}, T=${formatNumber(p.temperature)}, Jx=${formatNumber(p.jx)}, Jy=${formatNumber(p.jy)}, h=${formatNumber(p.field)}`;
  }
  const model = c.segment.model;
  if (model.kind === 'gaussian')
    return `a=${formatNumber(model.parameters.a)}, h=${formatNumber(model.parameters.h)}`;
  if (model.kind === 'spin') return `h=${formatNumber(model.parameters.h)}`;
  if (model.kind === 'binomial')
    return `n=${model.parameters.n}, p=${formatNumber(model.parameters.p)}`;
  const { domain } = model.parameters;
  return `${domain.name}, ${domain.vertices.length} sites, ${domain.edges.length} bonds`;
}
function rawCoverage(entry: ArchiveEntry) {
  const c = entry.scientific.capture;
  if (c.diagnosticRecord)
    return `${c.diagnosticRecord.count}/${sampleCount(entry)} observations, first #${c.diagnosticRecord.firstMeasurement}`;
  const count =
    c.workspace === 'small' && c.segment.model.kind === 'scalar'
      ? (c.segment.scalar?.trajectory.length ?? 0)
      : c.workspace === 'small'
        ? c.segment.trajectory.length
        : 0;
  return `${count} recent transitions (includes warm-up; older history unavailable)`;
}
function quality(entry: ArchiveEntry) {
  const c = entry.scientific.capture;
  return c.workspace === 'lattice'
    ? c.segment.diagnostics.m.status
    : (c.segment.ising?.diagnostics.m.status ?? 'N/A');
}
function Histogram({ entry }: { entry: ArchiveEntry }) {
  const c = entry.scientific.capture;
  const h =
    c.workspace === 'lattice' ? c.segment.mHistogram : c.segment.histogram;
  const peak = Math.max(1, ...h.bins);
  return (
    <svg
      role="img"
      aria-label="Saved segment histogram; counts by fixed bin"
      viewBox="0 0 520 160"
      className="archive-plot"
    >
      <line x1="38" x2="510" y1="132" y2="132" stroke="currentColor" />
      {h.bins.map((value, i) => (
        <rect
          key={i}
          x={40 + (i * 468) / h.bins.length}
          y={130 - (value / peak) * 110}
          width={Math.max(1, 468 / h.bins.length - 1)}
          height={(value / peak) * 110}
          fill="#14625a"
        />
      ))}
      <text x="40" y="150" fontSize="11">
        {formatNumber(h.min)}
      </text>
      <text x="475" y="150" fontSize="11">
        {formatNumber(h.max)}
      </text>
    </svg>
  );
}
function Series({ entry }: { entry: ArchiveEntry }) {
  const c = entry.scientific.capture;
  const values = c.diagnosticRecord?.m ?? [];
  if (!values.length)
    return (
      <p className="plot-note">
        No diagnostic observation series for this model; recent transitions are
        available in the portable bundle and CSV.
      </p>
    );
  const lower = Math.min(...values),
    upper = Math.max(...values);
  const scale = upper > lower ? upper - lower : 1;
  const path = values
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${40 + (i * 468) / Math.max(1, values.length - 1)},${125 - ((v - lower) / scale) * 105}`,
    )
    .join(' ');
  return (
    <svg
      role="img"
      aria-label="Saved recent magnetization observations; ordered by measurement index"
      viewBox="0 0 520 160"
      className="archive-plot"
    >
      <line x1="40" x2="508" y1="130" y2="130" stroke="currentColor" />
      <path d={path} fill="none" stroke="#14625a" strokeWidth="1.4" />
      <text x="40" y="150" fontSize="11">
        #{c.diagnosticRecord?.firstMeasurement}
      </text>
      <text x="455" y="150" fontSize="11">
        #{sampleCount(entry)}
      </text>
    </svg>
  );
}
function Detail({
  entry,
  change,
}: {
  entry: ArchiveEntry;
  change: (entry: ArchiveEntry) => void;
}) {
  const { scientific, annotation } = entry;
  const c = scientific.capture;
  const s = c.segment;
  const settings =
    c.workspace === 'lattice'
      ? c.segment.settings
      : { model: c.segment.model, sampler: c.segment.sampler };
  const diagnostics =
    c.workspace === 'lattice'
      ? c.segment.diagnostics
      : c.segment.ising?.diagnostics;
  return (
    <section
      className="model-card archive-detail"
      aria-label="Saved record details"
      data-testid="archive-detail"
    >
      <h2>{annotation.name}</h2>
      <div className="archive-fields">
        <label>
          Name
          <input
            aria-label="Saved record name"
            value={annotation.name}
            maxLength={120}
            onChange={(e) =>
              change(
                renameEntry(entry, {
                  ...annotation,
                  name: e.target.value || annotation.name,
                }),
              )
            }
          />
        </label>
        <label>
          Notes
          <textarea
            aria-label="Saved record notes"
            value={annotation.notes}
            maxLength={2000}
            onChange={(e) =>
              change(
                renameEntry(entry, { ...annotation, notes: e.target.value }),
              )
            }
          />
        </label>
      </div>
      <p>
        <strong>{modelName(entry)}</strong> · segment {s.id} ·{' '}
        {sampleCount(entry)} full-segment measurements · {rawCoverage(entry)}.
      </p>
      <p className="plot-note">
        {scientific.source.replayability === 'fresh-seeded'
          ? 'Fresh seeded segment: initial configuration and seed policy are known.'
          : 'Snapshot-only historical segment: inherited spins/RNG cannot be reconstructed from these final parameters and the original seed alone.'}{' '}
        Captured at update {scientific.source.captureUpdate}.{' '}
        {c.currentState
          ? 'Current configuration is tagged at this capture update.'
          : 'No end-of-segment configuration is archived.'}
      </p>
      <h3>Full-segment aggregate estimates</h3>
      <div className="archive-observables">
        {descriptors(entry).map((d) => (
          <div key={d.id}>
            <strong>{d.label}</strong>
            <span>
              {formatNumber(d.value)} {d.unit}
            </span>
          </div>
        ))}
      </div>
      <h3>Saved histogram and recent series</h3>
      <Histogram entry={entry} />
      <Series entry={entry} />
      <p className="plot-note">
        The histogram and full-segment moments include all retained
        measurements. The drawn series covers only the archived raw window; it
        is not a complete trajectory when older records were evicted.
      </p>
      {diagnostics && (
        <details open>
          <summary>M3a recent-window diagnostics</summary>
          {(['m', 'absM', 'e'] as const).map((key) => (
            <p key={key}>
              {key}: <strong>{diagnostics[key].status}</strong> ·{' '}
              {diagnostics[key].used}/{diagnostics[key].total} analyzed/full · τ{' '}
              {formatNumber(diagnostics[key].tauMeasurements)} retained
              observations · ESS {formatNumber(diagnostics[key].ess)} · SE{' '}
              {formatNumber(diagnostics[key].standardError)} of recent-window
              mean only.
            </p>
          ))}
          <p className="plot-note">
            A diagnostic summary can lag the latest full count because the
            worker refreshes it at measurement milestones. Captured raw rings
            retain the actual latest observations. No recent-window SE is
            assigned to full-segment or nonlinear estimates.
          </p>
        </details>
      )}
      <details>
        <summary>Numerical provenance and configuration</summary>
        <p>
          Dataset ID: <code>{scientific.datasetId}</code>
          <br />
          Group: <code>{scientific.groupId}</code>
          <br />
          Source: {scientific.source.workspace} run {scientific.source.runId},
          segment {scientific.source.segmentId}, worker version{' '}
          {scientific.source.workerVersion}.<br />
          Seed: {scientific.source.seed}; initialization:{' '}
          {scientific.source.initialization}; RNG:{' '}
          {scientific.source.rngAlgorithm}; build revision:{' '}
          {scientific.source.sourceRevision}; captured:{' '}
          {scientific.source.capturedAt}.
        </p>
        <pre className="archive-json">{JSON.stringify(settings, null, 2)}</pre>
      </details>
    </section>
  );
}
export function Experiments({
  entries,
  update,
  sweeps,
  updateSweeps,
}: {
  entries: ArchiveEntry[];
  update: (entries: ArchiveEntry[]) => void;
  sweeps: SavedSweep[];
  updateSweeps: (sweeps: SavedSweep[]) => void;
}) {
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    'Save a paused segment from Small Systems or Lattice Systems, or import a portable JSON bundle.',
  );
  const [observable, setObservable] = useState('');
  const active =
    entries.find((e) => e.libraryId === activeId) ?? entries.at(-1);
  const selectedEntries = entries.filter((e) => selected.includes(e.libraryId));
  const common = commonDescriptors(selectedEntries);
  const chosen = common.find((d) => d.id === observable) ?? common[0];
  function exportSelected(
    kind: 'bundle' | 'measurements' | 'metadata' | 'summary',
  ) {
    if (!selectedEntries.length) return;
    if (kind === 'bundle')
      download(
        'lattice-experiments.json',
        exportBundle(selectedEntries),
        'application/json',
      );
    if (kind === 'measurements')
      download(
        'lattice-measurements.csv',
        exportMeasurementsCsv(selectedEntries),
        'text/csv;charset=utf-8',
      );
    if (kind === 'metadata')
      download(
        'lattice-measurements.metadata.json',
        exportMeasurementMetadata(selectedEntries),
        'application/json',
      );
    if (kind === 'summary')
      download(
        'lattice-summary.csv',
        exportSummaryCsv(selectedEntries),
        'text/csv;charset=utf-8',
      );
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024)
        throw new Error('Import exceeds the 16 MiB file limit.');
      const content = await file.text();
      const current = entriesRef.current;
      // Parsing and scientific validation finish before either React archive
      // collection is published to the UI.
      const next = importPortableBundle(current, sweeps, content);
      update(next.entries);
      updateSweeps(next.sweeps);
      setNotice(
        `Imported ${next.entries.length - current.length} validated record(s) and ${next.sweeps.length - sweeps.length} sweep(s). Duplicate scientific IDs receive separate local library identities.`,
      );
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not import experiment bundle.',
      );
    }
  }
  return (
    <>
      <a className="skip-link" href="#experiments-main">
        Skip to Experiments
      </a>
      <header className="site-header">
        <a className="brand" href="#small-systems">
          <span className="brand-mark" aria-hidden="true">
            ▦
          </span>
          <span>
            Lattice <strong>Lab</strong>
          </span>
        </a>
        <nav aria-label="Workspaces">
          <a href="#small-systems">Small Systems</a>
          <a href="#lattice-systems">Lattice Systems</a>
          <a href="#fields-paths">Fields &amp; Paths</a>
          <a className="nav-active" aria-current="page" href="#experiments">
            Experiments
          </a>
        </nav>
        <a className="source-link" href="https://github.com/gantemur/lattice">
          Source ↗
        </a>
      </header>
      <main id="experiments-main" className="experiments-workspace">
        <section className="intro" id="experiments">
          <div>
            <p className="eyebrow">A numerical playground / 03</p>
            <h1>
              Keep the data. <span>Keep the context.</span>
            </h1>
            <p className="intro-copy">
              Archive individual parameter segments, inspect their numerical
              provenance, and compare compatible results.
            </p>
          </div>
          <span className="milestone">M3b2 · Experiments</span>
        </section>
        <p className="local-note">
          ◌ This library lives only in browser memory. Refreshing this page may
          discard it; export the portable JSON bundle first. No data are
          uploaded.
        </p>
        <p className="plot-note">
          Capacity: {entries.length}/{MAX_ARCHIVE_RECORDS} records, at most{' '}
          {MAX_ARCHIVE_BYTES / 1024 / 1024} MiB total. Saves and imports are
          refused at the limit; records are never silently evicted. Pause a live
          simulation and wait for its worker before saving.
        </p>
        <p role="status">{notice}</p>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <section className="model-card" aria-label="Import and export">
          <h2>Portable data</h2>
          <label>
            Import version-1 or version-2 JSON bundle{' '}
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import experiment JSON"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <div className="command-row">
            <button
              className="button"
              disabled={!selectedEntries.length}
              onClick={() => exportSelected('bundle')}
            >
              Download selected JSON bundle
            </button>
            <button
              className="button"
              disabled={!selectedEntries.length}
              onClick={() => exportSelected('measurements')}
            >
              Download measurements CSV
            </button>
            <button
              className="button"
              disabled={!selectedEntries.length}
              onClick={() => exportSelected('metadata')}
            >
              Download CSV metadata JSON
            </button>
            <button
              className="button"
              disabled={!selectedEntries.length}
              onClick={() => exportSelected('summary')}
            >
              Download summary CSV
            </button>
            <button
              className="button"
              disabled={!selectedEntries.length}
              onClick={() => {
                const linked = new Set(
                  sweeps.flatMap((s) =>
                    s.sourceRecordIds.map((record) => record.libraryId),
                  ),
                );
                if (selectedEntries.some((e) => linked.has(e.libraryId))) {
                  setError(
                    'Selected record belongs to an archived sweep. Remove the sweep before deleting its source data.',
                  );
                  return;
                }
                update(entries.filter((e) => !selected.includes(e.libraryId)));
                setSelected([]);
                setNotice(
                  `Removed ${selectedEntries.length} selected record(s) from browser memory.`,
                );
              }}
            >
              Remove selected
            </button>
          </div>
        </section>
        <SweepWorkspace
          entries={entries}
          sweeps={sweeps}
          updateEntries={update}
          updateSweeps={updateSweeps}
          openRecord={setActiveId}
        />
        <div className="experiments-grid">
          <section className="model-card" aria-label="Saved records">
            <h2>Saved records</h2>
            {entries.length === 0 && (
              <p>
                No records yet. Run and pause a simulation, then use Save
                current segment.
              </p>
            )}
            <div className="archive-list">
              {entries.map((e) => (
                <article
                  key={e.libraryId}
                  className={
                    active?.libraryId === e.libraryId
                      ? 'archive-row active'
                      : 'archive-row'
                  }
                >
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Select ${e.annotation.name}`}
                      checked={selected.includes(e.libraryId)}
                      onChange={(event) =>
                        setSelected((ids) =>
                          event.target.checked
                            ? [...ids, e.libraryId]
                            : ids.filter((id) => id !== e.libraryId),
                        )
                      }
                    />{' '}
                    Select
                  </label>
                  <button
                    className="archive-open"
                    onClick={() => setActiveId(e.libraryId)}
                  >
                    {e.annotation.name}
                  </button>
                  <small>
                    {modelName(e)} · {principalParameters(e)} ·{' '}
                    {e.scientific.capture.workspace === 'lattice'
                      ? e.scientific.capture.segment.settings.sampler
                      : e.scientific.capture.segment.sampler.kind}{' '}
                    · {sampleCount(e)} samples · {rawCoverage(e)} · diagnostic{' '}
                    {quality(e)}
                  </small>
                </article>
              ))}
            </div>
          </section>
          {active && (
            <Detail
              entry={active}
              change={(entry) =>
                update(
                  entries.map((e) =>
                    e.libraryId === entry.libraryId ? entry : e,
                  ),
                )
              }
            />
          )}
        </div>
        {selectedEntries.length > 0 && (
          <section className="model-card" aria-label="Compatible comparison">
            <h2>Compatible comparison</h2>
            <p className="plot-note">
              Compare full-segment point estimates side by side. Records retain
              separate settings and raw sequences; no pooling or uncertainty
              bars are implied.
            </p>
            {common.length === 0 ? (
              <p>
                No common observable with matching model convention and unit
                among selected records.
              </p>
            ) : (
              <>
                <label>
                  Observable{' '}
                  <select
                    aria-label="Comparison observable"
                    value={chosen?.id}
                    onChange={(e) => setObservable(e.target.value)}
                  >
                    {common.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label} ({d.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="archive-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Record</th>
                        <th>Value</th>
                        <th>Samples</th>
                        <th>Diagnostic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntries.map((e) => (
                        <tr key={e.libraryId}>
                          <td>{e.annotation.name}</td>
                          <td>
                            {formatNumber(
                              descriptors(e).find((d) => d.id === chosen?.id)
                                ?.value ?? null,
                            )}{' '}
                            {chosen?.unit}
                          </td>
                          <td>{sampleCount(e)}</td>
                          <td>{quality(e)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </>
  );
}
