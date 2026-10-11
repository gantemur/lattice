import { useEffect, useRef, useState } from 'react';
import type { ArchiveEntry } from '../experiments/archive';
import {
  addArchiveEntries,
  archiveBytes,
  createArchiveEntry,
  MAX_ARCHIVE_BYTES,
} from '../experiments/archive';
import { descriptors } from '../experiments/comparison';
import {
  exportSweepBundle,
  createSweepManifest,
  sweepCapacity,
} from '../experiments/sweepArchive';
import type { SavedSweep } from '../experiments/sweepArchive';
import {
  exportSweepMeasurementsCsv,
  exportSweepSummaryCsv,
  sweepPointEntry,
} from '../experiments/sweepExport';
import { SweepClient } from '../experiments/sweepClient';
import type { SweepReply } from '../experiments/sweepProtocol';
import {
  pointConfiguration,
  sweepPresets,
  validateSweepPlan,
} from '../experiments/sweepPlan';
import type { SweepAxis, SweepPlan } from '../experiments/sweepPlan';
import type { CompletedPoint, SweepProgress } from '../experiments/sweepRun';
import { formatNumber } from '../plotting/PlotFrame';
import { exactLatticeTwoByTwo } from '../models/latticeExact';

const observableIds = [
  'lattice:m',
  'lattice:absM',
  'lattice:e',
  'lattice:chi',
  'lattice:binder',
  'lattice:cv',
  'lattice:gx',
  'lattice:gy',
  'diagnostic:tau-m',
  'diagnostic:ess-m',
  'diagnostic:se-m',
];
const labels = [
  'm',
  '|m|',
  'e=H/N',
  'χ',
  'Binder U₄',
  'cV',
  'Gx(1)',
  'Gy(1)',
  'Recent m τ',
  'Recent m ESS',
  'Recent mean m SE',
];
const units = [
  'spin/site',
  'spin/site',
  'energy/site',
  'spin²/temperature',
  'dimensionless',
  'energy/(site·temperature)',
  'spin product',
  'spin product',
  'nominal sweeps',
  'observations',
  'spin/site',
];
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
function value(entry: ArchiveEntry | undefined, id: string): number | null {
  const capture = entry?.scientific.capture;
  if (capture?.workspace === 'lattice') {
    const d = capture.segment.diagnostics.m;
    if (id === 'diagnostic:tau-m') return d.tauSweeps;
    if (id === 'diagnostic:ess-m') return d.ess;
    if (id === 'diagnostic:se-m') return d.standardError;
  }
  return entry
    ? (descriptors(entry).find((d) => d.id === id)?.value ?? null)
    : null;
}
function exactValue(
  entry: ArchiveEntry | undefined,
  id: string,
): number | null {
  const capture = entry?.scientific.capture;
  if (capture?.workspace !== 'lattice') return null;
  const p = capture.segment.settings.parameters;
  if (p.lx !== 2 || p.ly !== 2 || id.startsWith('diagnostic:')) return null;
  const exact = exactLatticeTwoByTwo(p);
  const values: Record<string, number | null> = {
    'lattice:m': exact.meanM,
    'lattice:absM': exact.meanAbsM,
    'lattice:e': exact.meanE,
    'lattice:chi': exact.susceptibility,
    'lattice:binder': exact.binder,
    'lattice:cv': exact.specificHeat,
    'lattice:gx': exact.meanGx,
    'lattice:gy': exact.meanGy,
  };
  return values[id] ?? null;
}
function SweepPlot({
  sweeps,
  entries,
  observable,
}: {
  sweeps: SavedSweep[];
  entries: ArchiveEntry[];
  observable: string;
}) {
  const series = sweeps.map((sweep) =>
    sweep.scientific.points.flatMap((point) => {
      const entry = sweepPointEntry(sweep, point.datasetId, entries);
      const y = value(entry, observable);
      return point.status === 'completed' && y !== null && Number.isFinite(y)
        ? [{ x: point.value, y, index: point.index }]
        : [];
    }),
  );
  const all = series.flat();
  if (!all.length)
    return (
      <p className="plot-note">No completed points with this observable.</p>
    );
  const xs = all.map((p) => p.x),
    ys = all.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const dx = maxX - minX || 1,
    dy = maxY - minY || 1;
  const x = (n: number) => 55 + (435 * (n - minX)) / dx;
  const y = (n: number) => 145 - (115 * (n - minY)) / dy;
  const colors = ['#14625a', '#b05c2f', '#715692'];
  const critical =
    sweeps.length &&
    sweeps.every(
      (s) =>
        s.scientific.plan.varying === 'temperature' &&
        s.scientific.plan.base.parameters.jx === 1 &&
        s.scientific.plan.base.parameters.jy === 1 &&
        s.scientific.plan.base.parameters.field === 0,
    )
      ? 2 / Math.log(1 + Math.sqrt(2))
      : null;
  return (
    <svg
      className="archive-plot"
      viewBox="0 0 520 185"
      role="img"
      aria-label={`${labels[observableIds.indexOf(observable)]} (${units[observableIds.indexOf(observable)]}) versus ${sweeps[0]?.scientific.plan.varying}; physical numeric spacing`}
    >
      <line x1="55" x2="490" y1="145" y2="145" stroke="currentColor" />
      <line x1="55" x2="55" y1="25" y2="145" stroke="currentColor" />
      {critical !== null && critical >= minX && critical <= maxX && (
        <>
          <line
            x1={x(critical)}
            x2={x(critical)}
            y1="27"
            y2="145"
            stroke="#a87038"
            strokeDasharray="4 4"
          />
          <text x={x(critical) + 3} y="25" fontSize="10">
            infinite-volume Tc
          </text>
        </>
      )}
      {series.map((points, i) => (
        <g key={sweeps[i]!.localId}>
          {points.length > 1 && (
            <path
              d={points
                .map((p, j) => `${j ? 'L' : 'M'}${x(p.x)},${y(p.y)}`)
                .join(' ')}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="2"
            />
          )}
          {points.map((p) => (
            <circle
              key={p.index}
              cx={x(p.x)}
              cy={y(p.y)}
              r="4"
              fill={colors[i % colors.length]}
            >
              <title>
                {sweeps[i]!.scientific.name}: x={p.x},{' '}
                {labels[observableIds.indexOf(observable)]}={formatNumber(p.y)}
              </title>
            </circle>
          ))}
        </g>
      ))}
      <text x="55" y="162" fontSize="11">
        {formatNumber(minX)}
      </text>
      <text x="453" y="162" fontSize="11">
        {formatNumber(maxX)}
      </text>
      <text x="210" y="179" fontSize="11">
        {sweeps[0]?.scientific.plan.varying}
      </text>
      <text x="4" y="35" fontSize="11">
        {formatNumber(maxY)}
      </text>
      <text x="4" y="145" fontSize="11">
        {formatNumber(minY)}
      </text>
    </svg>
  );
}
export function SweepWorkspace({
  entries,
  sweeps,
  updateEntries,
  updateSweeps,
  openRecord,
}: {
  entries: ArchiveEntry[];
  sweeps: SavedSweep[];
  updateEntries: (next: ArchiveEntry[]) => void;
  updateSweeps: (next: SavedSweep[]) => void;
  openRecord: (id: string) => void;
}) {
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const sweepsRef = useRef(sweeps);
  sweepsRef.current = sweeps;
  const [plan, setPlan] = useState<SweepPlan>(() =>
    structuredClone(sweepPresets.temperature),
  );
  const [valuesText, setValuesText] = useState(
    sweepPresets.temperature.values.join(', '),
  );
  const [progress, setProgress] = useState<SweepProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    'Choose a preset or edit the plan. Each point starts a fresh seeded lattice run.',
  );
  const [observable, setObservable] = useState('lattice:absM');
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const [pending, setPending] = useState<CompletedPoint | null>(null);
  const pendingRef = useRef<CompletedPoint | null>(null);
  const stagedArchiveRef = useRef<{
    pointIndex: number;
    entry: ArchiveEntry;
  } | null>(null);
  const clientRef = useRef<SweepClient | null>(null);
  const runIdRef = useRef('');
  const runPlanRef = useRef<SweepPlan | null>(null);
  const completedRef = useRef<
    {
      index: number;
      datasetId: string;
      updates: number;
      measurements: number;
    }[]
  >([]);
  const terminalRef = useRef<Extract<SweepReply, { type: 'terminal' }> | null>(
    null,
  );
  const running =
    progress?.status === 'running' || progress?.status === 'paused';
  const activePoint =
    progress &&
    runPlanRef.current &&
    progress.pointIndex < runPlanRef.current.values.length
      ? pointConfiguration(runPlanRef.current, progress.pointIndex)
      : null;

  function finalize(reply: Extract<SweepReply, { type: 'terminal' }>) {
    terminalRef.current = reply;
    if (pendingRef.current || !runPlanRef.current) return;
    try {
      const manifest = createSweepManifest(
        runPlanRef.current,
        runIdRef.current,
        reply.error
          ? 'error'
          : reply.progress.status === 'completed'
            ? 'completed'
            : 'cancelled',
        completedRef.current,
        reply.partial,
        entriesRef.current,
      );
      if (
        archiveBytes({
          entries: entriesRef.current,
          sweeps: [...sweepsRef.current, manifest],
        }) > MAX_ARCHIVE_BYTES
      )
        throw new Error(
          'Archive limit reached while saving the sweep manifest. Export or remove records, then retry.',
        );
      updateSweeps([...sweepsRef.current, manifest]);
      setNotice(
        `Sweep ${manifest.scientific.status}: ${completedRef.current.length} completed point(s) archived.`,
      );
      if (reply.error) setError(reply.error);
      terminalRef.current = null;
      runPlanRef.current = null;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save sweep manifest.',
      );
    }
  }
  function archivePoint(point: CompletedPoint) {
    try {
      // Commit the record identity before publishing or acknowledging it. A
      // failed publish/ACK can then be retried without appending it again.
      const alreadyCompleted = completedRef.current.some(
        (done) => done.index === point.index,
      );
      if (
        alreadyCompleted &&
        stagedArchiveRef.current?.pointIndex !== point.index
      )
        return;
      if (!alreadyCompleted) {
        const entry = createArchiveEntry(
          point.capture,
          runIdRef.current,
          `${runPlanRef.current?.name} · point ${point.index + 1} (${runPlanRef.current?.varying}=${formatNumber(point.value)})`,
        );
        const next = addArchiveEntries(entriesRef.current, [entry]);
        if (
          archiveBytes({ entries: next, sweeps: sweepsRef.current }) >
          MAX_ARCHIVE_BYTES
        )
          throw new Error(
            'Archive byte limit reached. Remove other records or export them before continuing.',
          );
        entriesRef.current = next;
        stagedArchiveRef.current = { pointIndex: point.index, entry };
        completedRef.current.push({
          index: point.index,
          datasetId: entry.scientific.datasetId,
          updates: point.updates,
          measurements: point.capture.segment.samples,
        });
      } else if (
        !entriesRef.current.some(
          (entry) =>
            entry.libraryId === stagedArchiveRef.current!.entry.libraryId,
        )
      ) {
        entriesRef.current = addArchiveEntries(entriesRef.current, [
          stagedArchiveRef.current!.entry,
        ]);
      }
      updateEntries(entriesRef.current);
      if (!terminalRef.current) clientRef.current?.acknowledge(point.index);
      stagedArchiveRef.current = null;
      pendingRef.current = null;
      setPending(null);
      setError(null);
      if (terminalRef.current) finalize(terminalRef.current);
    } catch (cause) {
      pendingRef.current = point;
      setPending(point);
      setError(
        `${cause instanceof Error ? cause.message : 'Archive failed.'} Completed point ${point.index + 1} remains staged in memory. The worker is waiting; free capacity and retry archive or cancel.`,
      );
    }
  }
  useEffect(() => {
    const client = new SweepClient(
      new Worker(new URL('../workers/sweep.worker.ts', import.meta.url), {
        type: 'module',
      }),
    );
    clientRef.current = client;
    client.onReply = (reply) => {
      if (reply.type === 'error') {
        setError(reply.error);
        runPlanRef.current = null;
        return;
      }
      if (reply.type === 'command-error') {
        setProgress(reply.progress);
        setError(reply.error);
        return;
      }
      setProgress(reply.progress);
      if (reply.type === 'point') archivePoint(reply.point);
      if (reply.type === 'terminal') finalize(reply);
    };
    client.onError = (message) => {
      setProgress((previous) =>
        previous ? { ...previous, status: 'cancelled' } : null,
      );
      setError(
        `${message} Completed point records remain in the library. An interrupted point's exact work count is unknown, so no sweep manifest was fabricated.`,
      );
      runPlanRef.current = null;
    };
    return () => {
      clientRef.current = null;
      client.dispose();
    };
  }, []);
  function mutate(patch: Partial<SweepPlan>) {
    setPlan((p) => ({ ...p, ...patch }));
  }
  function mutateBase(patch: Partial<SweepPlan['base']>) {
    setPlan((p) => ({ ...p, base: { ...p.base, ...patch } }));
  }
  function mutateParams(patch: Partial<SweepPlan['base']['parameters']>) {
    setPlan((p) => ({
      ...p,
      base: { ...p.base, parameters: { ...p.base.parameters, ...patch } },
    }));
  }
  function currentPlan() {
    return {
      ...plan,
      values: valuesText
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(Number),
    };
  }
  let budget: ReturnType<typeof validateSweepPlan> | null = null;
  let planError: string | null = null;
  try {
    budget = validateSweepPlan(currentPlan());
  } catch (cause) {
    planError = cause instanceof Error ? cause.message : 'Invalid plan.';
  }
  const capacity =
    budget && sweepCapacity(entries, sweeps, currentPlan()).available;
  function start() {
    try {
      const configured = currentPlan();
      validateSweepPlan(configured);
      if (!capacity)
        throw new Error(
          'Insufficient archive capacity for all sweep points. Export or remove records first.',
        );
      if (pendingRef.current || terminalRef.current)
        throw new Error('Archive the pending point or manifest first.');
      const fixed = structuredClone(configured);
      completedRef.current = [];
      stagedArchiveRef.current = null;
      runPlanRef.current = fixed;
      runIdRef.current = clientRef.current!.start(fixed);
      setProgress(null);
      setError(null);
      setNotice('Sweep started: independent seeded points run sequentially.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not start sweep.',
      );
    }
  }
  function command(type: 'pause' | 'resume' | 'cancel') {
    try {
      clientRef.current?.command(type);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Sweep command failed.',
      );
    }
  }
  const selectedSweeps = sweeps
    .filter((s) => chosenIds.includes(s.localId))
    .slice(0, 3);
  const compatible =
    selectedSweeps.length <= 1 ||
    selectedSweeps.every(
      (s) =>
        s.scientific.plan.varying ===
        selectedSweeps[0]!.scientific.plan.varying,
    );
  const field = (
    label: string,
    key: keyof SweepPlan['base']['parameters'],
    min?: number,
  ) => (
    <label>
      {label}
      <input
        type="number"
        step="any"
        min={min}
        disabled={running}
        value={plan.base.parameters[key] as number}
        onChange={(e) => mutateParams({ [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <section
      className="model-card sweep-workspace"
      aria-label="Parameter sweeps"
    >
      <h2>Independent 2D Ising sweeps</h2>
      <p className="plot-note">
        Each parameter point uses a fresh configuration and deterministic
        indexed seed. Warm-up, stride, and measurements apply separately to
        every point. These are Monte Carlo comparisons, not a cooling trajectory
        or physical time.
      </p>
      <div className="command-row">
        {(['temperature', 'field', 'size'] as const).map((preset) => (
          <button
            key={preset}
            className="button"
            disabled={running}
            onClick={() => {
              const p = structuredClone(sweepPresets[preset]);
              setPlan(p);
              setValuesText(p.values.join(', '));
            }}
          >
            {preset === 'temperature'
              ? 'Temperature scan'
              : preset === 'field'
                ? 'Field response'
                : 'Finite-size comparison'}
          </button>
        ))}
      </div>
      <p className="plot-note">
        <strong>{plan.question}</strong> {plan.description} The physical
        Hamiltonian is H=−JxΣₓsᵢsⱼ−JyΣᵧsᵢsⱼ−hΣᵢsᵢ, with target weight
        proportional to exp(−H/T). Finite-size rounding and slow mixing near the
        isotropic infinite-volume Tc can obscure short-run trends; vary the
        budget and seed before drawing conclusions.
      </p>
      <details>
        <summary>Edit sweep plan</summary>
        <div className="sweep-form">
          <label>
            Sweep title
            <input
              disabled={running}
              maxLength={120}
              value={plan.name}
              onChange={(e) => mutate({ name: e.target.value })}
            />
          </label>
          <label>
            Experiment question
            <input
              disabled={running}
              maxLength={500}
              value={plan.question}
              onChange={(e) => mutate({ question: e.target.value })}
            />
          </label>
          <label>
            Description
            <input
              disabled={running}
              maxLength={1000}
              value={plan.description}
              onChange={(e) => mutate({ description: e.target.value })}
            />
          </label>
          <label>
            Varying parameter
            <select
              disabled={running}
              value={plan.varying}
              onChange={(e) => mutate({ varying: e.target.value as SweepAxis })}
            >
              {(['temperature', 'field', 'jx', 'jy', 'size'] as const).map(
                (axis) => (
                  <option key={axis} value={axis}>
                    {axis}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="sweep-wide">
            Ordered values (2–12, comma separated)
            <input
              disabled={running}
              value={valuesText}
              onChange={(e) => {
                setValuesText(e.target.value);
                mutate({
                  values: e.target.value
                    .split(/[\s,;]+/)
                    .filter(Boolean)
                    .map(Number),
                });
              }}
            />
          </label>
          <label>
            Sweep update rule
            <select
              disabled={running}
              value={plan.base.sampler}
              onChange={(e) =>
                mutateBase({
                  sampler: e.target.value as 'metropolis' | 'heat-bath',
                })
              }
            >
              <option value="metropolis">Metropolis</option>
              <option value="heat-bath">Heat bath</option>
            </select>
          </label>
          <label>
            Point initial configuration
            <select
              disabled={running}
              value={plan.base.initialization}
              onChange={(e) =>
                mutateBase({
                  initialization: e.target.value as 'plus' | 'minus' | 'random',
                })
              }
            >
              <option value="random">Random</option>
              <option value="plus">All +</option>
              <option value="minus">All −</option>
            </select>
          </label>
          {field('Sweep base horizontal sites', 'lx', 2)}
          {field('Sweep base vertical sites', 'ly', 2)}
          {field('Sweep base temperature', 'temperature', 0.05)}
          {field('Sweep base horizontal coupling', 'jx')}
          {field('Sweep base vertical coupling', 'jy')}
          {field('Sweep base field', 'field')}
          <label>
            Sweep horizontal wrap
            <input
              type="checkbox"
              disabled={running}
              checked={plan.base.parameters.periodicX}
              onChange={(e) => mutateParams({ periodicX: e.target.checked })}
            />
          </label>
          <label>
            Sweep vertical wrap
            <input
              type="checkbox"
              disabled={running}
              checked={plan.base.parameters.periodicY}
              onChange={(e) => mutateParams({ periodicY: e.target.checked })}
            />
          </label>
          <label>
            Point warm-up (sweeps)
            <input
              type="number"
              disabled={running}
              min="0"
              max="10000"
              value={plan.base.warmupSweeps}
              onChange={(e) =>
                mutateBase({ warmupSweeps: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Point measurement stride (sweeps)
            <input
              type="number"
              disabled={running}
              min="1"
              max="100"
              value={plan.base.strideSweeps}
              onChange={(e) =>
                mutateBase({ strideSweeps: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Measurements / point
            <input
              type="number"
              disabled={running}
              min="1"
              max="8192"
              value={plan.measurementsPerPoint}
              onChange={(e) =>
                mutate({ measurementsPerPoint: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Sweep seed base
            <input
              type="number"
              disabled={running}
              min="0"
              max="4294967295"
              value={plan.baseSeed}
              onChange={(e) => mutate({ baseSeed: Number(e.target.value) })}
            />
          </label>
        </div>
      </details>
      {planError ? (
        <p className="error-message" role="alert">
          {planError}
        </p>
      ) : (
        budget && (
          <p className="plot-note" data-testid="sweep-budget">
            {plan.values.length} independent points ·{' '}
            {budget.totalUpdates.toLocaleString()} elementary updates ·{' '}
            {budget.totalNominalSweeps.toLocaleString()} nominal sweeps · up to{' '}
            {(budget.estimatedArchiveBytes / 1024 / 1024).toFixed(2)} MiB
            estimated archive reservation.{' '}
            {capacity
              ? 'Archive capacity available.'
              : 'Archive capacity insufficient.'}
          </p>
        )
      )}
      <div className="command-row">
        <button
          className="button primary"
          disabled={
            !!running ||
            !!planError ||
            !capacity ||
            !!pending ||
            !!terminalRef.current
          }
          onClick={start}
        >
          Start sweep
        </button>
        <button
          className="button"
          disabled={progress?.status !== 'running'}
          onClick={() => command('pause')}
        >
          Pause sweep
        </button>
        <button
          className="button"
          disabled={progress?.status !== 'paused'}
          onClick={() => command('resume')}
        >
          Resume sweep
        </button>
        <button
          className="button"
          disabled={
            (!running && !pending) ||
            !!terminalRef.current ||
            !runPlanRef.current
          }
          onClick={() => command('cancel')}
        >
          Cancel sweep
        </button>
      </div>
      {progress && (
        <p role="status" data-testid="sweep-progress">
          {progress.status} · {progress.completedPoints}/
          {runPlanRef.current?.values.length ?? plan.values.length} completed ·
          {activePoint
            ? `point ${progress.pointIndex + 1}: ${progress.currentPointUpdates} elementary updates, ${Math.floor(progress.currentPointUpdates / (activePoint.parameters.lx * activePoint.parameters.ly))} nominal sweeps, ${progress.currentPointMeasurements} measurements`
            : 'all points finished'}{' '}
          · {progress.totalUpdates.toLocaleString()}/
          {progress.requestedUpdates.toLocaleString()} updates
        </p>
      )}
      <p role="status">{notice}</p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <button className="button" onClick={() => archivePoint(pending)}>
          Retry archiving staged point {pending.index + 1}
        </button>
      )}
      {terminalRef.current && !pending && (
        <button
          className="button"
          onClick={() => finalize(terminalRef.current!)}
        >
          Retry saving sweep manifest
        </button>
      )}
      <h3>Archived sweeps</h3>
      {!sweeps.length && <p className="plot-note">No sweep archived yet.</p>}
      <div className="sweep-list">
        {sweeps.map((sweep) => (
          <article key={sweep.localId} className="archive-row">
            <label>
              <input
                type="checkbox"
                aria-label={`Compare ${sweep.scientific.name}`}
                checked={chosenIds.includes(sweep.localId)}
                onChange={(e) =>
                  setChosenIds((ids) =>
                    e.target.checked
                      ? [
                          ...ids.filter((id) => id !== sweep.localId).slice(-2),
                          sweep.localId,
                        ]
                      : ids.filter((id) => id !== sweep.localId),
                  )
                }
              />{' '}
              Compare
            </label>
            <strong>{sweep.scientific.name}</strong> · {sweep.scientific.status}{' '}
            ·{' '}
            {
              sweep.scientific.points.filter((p) => p.status === 'completed')
                .length
            }
            /{sweep.scientific.points.length} points
            <p className="plot-note">
              {sweep.scientific.plan.base.sampler} ·{' '}
              {sweep.scientific.plan.base.initialization} start ·{' '}
              {sweep.scientific.plan.base.warmupSweeps} warm-up sweeps · stride{' '}
              {sweep.scientific.plan.base.strideSweeps} ·{' '}
              {sweep.scientific.plan.measurementsPerPoint} measurements/point ·{' '}
              {sweep.scientific.plan.base.parameters.periodicX
                ? 'periodic'
                : 'open'}{' '}
              x /{' '}
              {sweep.scientific.plan.base.parameters.periodicY
                ? 'periodic'
                : 'open'}{' '}
              y. Base: {sweep.scientific.plan.base.parameters.lx}×
              {sweep.scientific.plan.base.parameters.ly}, T=
              {formatNumber(sweep.scientific.plan.base.parameters.temperature)},
              Jx={formatNumber(sweep.scientific.plan.base.parameters.jx)}, Jy=
              {formatNumber(sweep.scientific.plan.base.parameters.jy)}, h=
              {formatNumber(sweep.scientific.plan.base.parameters.field)};
              varying {sweep.scientific.plan.varying}.
            </p>
            <div className="command-row">
              <button
                className="button"
                onClick={() => {
                  setPlan(structuredClone(sweep.scientific.plan));
                  setValuesText(sweep.scientific.plan.values.join(', '));
                }}
              >
                Copy plan to editor
              </button>
              <button
                className="button"
                onClick={() =>
                  download(
                    'lattice-sweep.json',
                    exportSweepBundle(sweep, entries),
                    'application/json',
                  )
                }
              >
                Download sweep JSON
              </button>
              <button
                className="button"
                onClick={() =>
                  download(
                    'lattice-sweep-summary.csv',
                    exportSweepSummaryCsv(sweep, entries),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                Download sweep summary CSV
              </button>
              <button
                className="button"
                onClick={() =>
                  download(
                    'lattice-sweep-measurements.csv',
                    exportSweepMeasurementsCsv(sweep, entries),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                Download point measurements CSV
              </button>
              <button
                className="button"
                onClick={() => {
                  updateSweeps(
                    sweeps.filter((s) => s.localId !== sweep.localId),
                  );
                  setChosenIds((ids) =>
                    ids.filter((id) => id !== sweep.localId),
                  );
                }}
              >
                Remove sweep manifest
              </button>
            </div>
          </article>
        ))}
      </div>
      {selectedSweeps.length > 0 && (
        <section aria-label="Sweep comparison">
          <h3>Parameter-axis comparison</h3>
          {!compatible ? (
            <p>
              Selected sweeps vary different parameters; choose sweeps on one
              common axis.
            </p>
          ) : (
            <>
              <label>
                Observable{' '}
                <select
                  aria-label="Sweep observable"
                  value={observable}
                  onChange={(e) => setObservable(e.target.value)}
                >
                  {observableIds.map((id, i) => (
                    <option key={id} value={id}>
                      {labels[i]} ({units[i]})
                    </option>
                  ))}
                </select>
              </label>
              <p className="plot-note">
                Points retain numeric parameter spacing. Each completed point is
                an independent finite-lattice estimate. Recent-window
                diagnostics describe mixing and do not give uncertainty for the
                full-segment mean or nonlinear observables. Unavailable numeric
                diagnostics are N/A in the table and omitted from the plot. Near
                criticality, slow mixing can bias short runs.
              </p>
              <SweepPlot
                sweeps={selectedSweeps}
                entries={entries}
                observable={observable}
              />
              <div className="sweep-legend">
                {selectedSweeps.map((s, i) => (
                  <span
                    key={s.localId}
                    style={{ color: ['#14625a', '#b05c2f', '#715692'][i] }}
                  >
                    {s.scientific.name}
                  </span>
                ))}
              </div>
              <div className="archive-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sweep / point</th>
                      <th>Value</th>
                      <th>Seed</th>
                      <th>Samples</th>
                      <th>{labels[observableIds.indexOf(observable)]}</th>
                      <th>Exact 2×2 reference</th>
                      <th>Diagnostic</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSweeps.flatMap((s) =>
                      s.scientific.points.map((p) => {
                        const entry = sweepPointEntry(s, p.datasetId, entries);
                        const d =
                          entry?.scientific.capture.workspace === 'lattice'
                            ? entry.scientific.capture.segment.diagnostics.m
                            : null;
                        return (
                          <tr key={`${s.localId}-${p.index}`}>
                            <td>
                              {s.scientific.name} #{p.index + 1} · {p.status}
                            </td>
                            <td>{formatNumber(p.value)}</td>
                            <td>{p.seed}</td>
                            <td>{p.measurements}</td>
                            <td>{formatNumber(value(entry, observable))}</td>
                            <td>
                              {formatNumber(exactValue(entry, observable))}
                            </td>
                            <td>
                              {d?.status ?? 'N/A'}
                              {d?.status !== 'ok' && d?.message
                                ? ` · ${d.message}`
                                : ''}
                            </td>
                            <td>
                              {entry && (
                                <button
                                  className="button"
                                  onClick={() => openRecord(entry.libraryId)}
                                >
                                  Inspect
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
      <p className="plot-note">
        Resetting the page loses the in-memory library. Export JSON to preserve
        numerical records. Imports are read-only until you explicitly copy a
        plan and start a new sweep.
      </p>
    </section>
  );
}
