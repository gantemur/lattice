import { useState } from 'react';
import { SiteHeader } from './SiteHeader';
import { useLatticeSession } from './useLatticeSession';
import { ChainToolDeck } from './ChainToolDeck';
import type { Capture } from '../experiments/archive';
import type { LatticeConfiguration } from '../engine/latticeRun';
import { formatNumber } from '../plotting/PlotFrame';
import { InlineMath, DisplayMath } from '../ui/Math';

export const defaultChainConfiguration: LatticeConfiguration = {
  parameters: {
    lx: 32,
    ly: 1,
    periodicX: true,
    periodicY: false,
    jx: 1,
    jy: 0,
    field: 0,
    temperature: 2,
  },
  sampler: 'metropolis',
  warmupSweeps: 20,
  strideSweeps: 1,
  seed: 12345,
  initialization: 'random',
};

type Preset = {
  label: string;
  parameters: Partial<LatticeConfiguration['parameters']>;
};
const presets: Preset[] = [
  {
    label: 'High T · short correlations',
    parameters: { lx: 32, periodicX: true, jx: 1, field: 0, temperature: 5 },
  },
  {
    label: 'Lower T · longer correlations',
    parameters: { lx: 32, periodicX: true, jx: 1, field: 0, temperature: 0.7 },
  },
  {
    label: 'External field',
    parameters: { lx: 32, periodicX: true, jx: 1, field: 0.5, temperature: 2 },
  },
  {
    label: 'Open ends',
    parameters: { lx: 32, periodicX: false, jx: 1, field: 0.5, temperature: 2 },
  },
  {
    label: 'Antiferromagnetic',
    parameters: {
      lx: 32,
      periodicX: false,
      jx: -1,
      field: 0,
      temperature: 1.2,
    },
  },
  {
    label: 'Odd frustrated ring',
    parameters: { lx: 15, periodicX: true, jx: -1, field: 0, temperature: 0.7 },
  },
];

export function ChainSystems({
  saveCaptures,
  archiveCount,
  switchToGrid,
  chooseSystem,
  active = true,
}: {
  saveCaptures: (captures: Capture[]) => void;
  archiveCount: number;
  switchToGrid: () => void;
  chooseSystem?: (id: '2d' | 'chain' | 'potts' | 'xy') => void;
  active?: boolean;
}) {
  const { view, client } = useLatticeSession(defaultChainConfiguration);
  const snapshot = view.snapshot;
  const current = snapshot?.segments.at(-1);
  const [draft, setDraft] = useState<LatticeConfiguration>(
    defaultChainConfiguration,
  );
  const [seed, setSeed] = useState(String(defaultChainConfiguration.seed));
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    'Choose settings, then Step or Run. Initial spins are not measurements.',
  );
  const patch = (parameters: Partial<LatticeConfiguration['parameters']>) =>
    setDraft((old) => ({
      ...old,
      parameters: { ...old.parameters, ...parameters },
    }));
  const act = (action: () => void, message: string) => {
    try {
      action();
      setError(null);
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Invalid chain settings.',
      );
    }
  };
  const apply = () => {
    if (!snapshot) return;
    const old = snapshot.configuration.parameters,
      next = draft.parameters;
    const geometry = old.lx !== next.lx || old.periodicX !== next.periodicX;
    act(
      () => {
        if (geometry) {
          client.current?.initialize({ ...draft, seed: Number(seed) });
          setSelected(0);
        } else
          client.current?.change({
            parameters: next,
            sampler: draft.sampler,
            warmupSweeps: draft.warmupSweeps,
            strideSweeps: draft.strideSweeps,
          });
      },
      geometry
        ? 'Chain length/boundary changed: new seeded session.'
        : 'Applied physical settings: spins and RNG preserved; a separate measurement segment begins with fresh warm-up.',
    );
  };
  const reset = () =>
    act(() => {
      client.current?.initialize({
        ...snapshot!.configuration,
        seed: Number(seed),
        initialization: draft.initialization,
      });
      setSelected(0);
    }, 'Reset restarted the applied chain with the selected seed and initialization.');
  async function save(all: boolean) {
    if (!snapshot || !client.current) return;
    try {
      const ids = all
        ? snapshot.segments.map((s) => s.id)
        : [snapshot.activeSegmentId];
      const captures: Capture[] = [];
      for (const id of ids) captures.push(await client.current.capture(id));
      if (
        captures.some(
          (c) =>
            c.runId !== captures[0]?.runId ||
            c.version !== captures[0]?.version,
        )
      )
        throw new Error('Worker changed during capture; pause and retry.');
      saveCaptures(captures);
      setError(null);
      setNotice(`Saved ${captures.length} chain segment(s) to Experiments.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Capture failed.');
    }
  }
  const p =
    snapshot?.configuration.parameters ?? defaultChainConfiguration.parameters;
  return (
    <>
      <a className="skip-link" href="#lattice-laboratory">
        Skip to laboratory
      </a>
      <SiteHeader active="lattice" archiveCount={archiveCount} />
      <main id="lattice-laboratory">
        <section className="intro" id="lattice-systems">
          <div>
            <p className="eyebrow">A numerical playground / 02</p>
            <h1>
              One chain. <span>Exact spatial structure.</span>
            </h1>
            <p className="intro-copy">
              Compare local Monte Carlo with the finite-length 2×2 transfer
              matrix. Follow spatial correlations without confusing them with
              algorithmic time.
            </p>
          </div>
          <span className="milestone">1D classical Ising</span>
        </section>
        <div className="lab-layout">
          <aside className="sidebar" aria-label="Chain settings">
            <label className="model-choice">
              Physical system
              <select
                aria-label={
                  active
                    ? 'Lattice physical system'
                    : 'Inactive Ising physical system'
                }
                value="chain"
                onChange={(e) =>
                  ['potts', 'xy'].includes(e.target.value)
                    ? chooseSystem?.(e.target.value as 'potts' | 'xy')
                    : switchToGrid()
                }
              >
                <option value="2d">2D square-lattice Ising</option>
                <option value="chain">1D Ising chain</option>
                <option value="potts">2D Potts</option>
                <option value="xy">2D XY</option>
              </select>
            </label>
            <section className="model-card lattice-model-card">
              <p className="eyebrow">Nearest-neighbor chain</p>
              <DisplayMath>{String.raw`H=-J\sum_{(i,i+1)}s_i s_{i+1}-h\sum_i s_i`}</DisplayMath>
              <p>
                Physical energy <InlineMath>H</InlineMath>, action{' '}
                <InlineMath>{String.raw`S=H/T`}</InlineMath>,{' '}
                <InlineMath>{String.raw`k_B=1`}</InlineMath>. Each actual bond
                contributes once; there is no transverse direction.
              </p>
            </section>
            <details className="settings" open>
              <summary>Chain geometry & physical settings</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  apply();
                }}
              >
                <label>
                  Teaching preset
                  <select
                    aria-label="Chain teaching preset"
                    defaultValue="custom"
                    onChange={(e) => {
                      const item = presets[Number(e.target.value)];
                      if (item) patch(item.parameters);
                    }}
                  >
                    <option value="custom">Choose a draft example</option>
                    {presets.map((item, i) => (
                      <option key={item.label} value={i}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Chain length N
                  <input
                    aria-label="Chain length N"
                    type="number"
                    min={draft.parameters.periodicX ? 3 : 2}
                    max="64"
                    value={draft.parameters.lx}
                    onChange={(e) => patch({ lx: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Boundary
                  <select
                    aria-label="Chain boundary"
                    value={draft.parameters.periodicX ? 'periodic' : 'open'}
                    onChange={(e) =>
                      patch({ periodicX: e.target.value === 'periodic' })
                    }
                  >
                    <option value="open">Open ends</option>
                    <option value="periodic">Periodic ring</option>
                  </select>
                </label>
                <label>
                  Temperature T
                  <input
                    aria-label="Chain temperature T"
                    type="number"
                    min="0.05"
                    max="100"
                    step="any"
                    value={draft.parameters.temperature}
                    onChange={(e) =>
                      patch({ temperature: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Bond coupling J
                  <input
                    aria-label="Chain coupling J"
                    type="number"
                    min="-10"
                    max="10"
                    step="any"
                    value={draft.parameters.jx}
                    onChange={(e) => patch({ jx: Number(e.target.value) })}
                  />
                </label>
                <label>
                  External field h
                  <input
                    aria-label="Chain field h"
                    type="number"
                    min="-10"
                    max="10"
                    step="any"
                    value={draft.parameters.field}
                    onChange={(e) => patch({ field: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Sampler
                  <select
                    aria-label="Chain sampler"
                    value={draft.sampler}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        sampler: e.target
                          .value as LatticeConfiguration['sampler'],
                      }))
                    }
                  >
                    <option value="metropolis">
                      Random-site lazy Metropolis
                    </option>
                    <option value="heat-bath">Random-site heat bath</option>
                  </select>
                </label>
                <div className="lattice-form-pair">
                  <label>
                    Warm-up sweeps
                    <input
                      aria-label="Chain warm-up sweeps"
                      type="number"
                      min="0"
                      max="10000"
                      value={draft.warmupSweeps}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          warmupSweeps: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Measure every sweeps
                    <input
                      aria-label="Chain measurement stride"
                      type="number"
                      min="1"
                      max="100"
                      value={draft.strideSweeps}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          strideSweeps: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
                <label>
                  Initialization on new session
                  <select
                    aria-label="Chain initialization"
                    value={draft.initialization}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        initialization: e.target
                          .value as LatticeConfiguration['initialization'],
                      }))
                    }
                  >
                    <option value="random">Seeded random ±1</option>
                    <option value="plus">All +1</option>
                    <option value="minus">All −1</option>
                  </select>
                </label>
                <label>
                  Seed on new session / Reset
                  <input
                    aria-label="Chain seed"
                    type="number"
                    min="0"
                    max="4294967295"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                </label>
                <button
                  className="button primary"
                  type="submit"
                  disabled={!snapshot || !!view.error}
                >
                  Apply settings
                </button>
                <p className="settings-warning">
                  Presets edit the draft. Changing N or boundary starts a seeded
                  session; changing J, h, T or sampler preserves spins/RNG and
                  starts an isolated segment with warm-up.
                </p>
              </form>
            </details>
            <div className="local-note">
              ◌ Computation stays in your browser.
            </div>
          </aside>
          <div className="workspace">
            <section className="run-panel" aria-label="Chain sampling controls">
              <div className="run-heading">
                <div>
                  <strong role="status" data-testid="lattice-status">
                    {view.error
                      ? 'Worker unavailable'
                      : view.running
                        ? 'Sampling'
                        : view.busy
                          ? 'Finishing update'
                          : 'Paused'}
                  </strong>
                  <span className="segment" data-testid="lattice-segment">
                    Segment {snapshot?.activeSegmentId ?? '…'}
                  </span>
                </div>
                <span className="algorithm-label">
                  {snapshot?.configuration.sampler ?? 'Metropolis'}
                </span>
              </div>
              <div className="command-row">
                <button
                  className="button primary"
                  disabled={!snapshot || !!view.error}
                  onClick={() => {
                    if (view.running) {
                      client.current?.pause();
                      setNotice('Paused after the current bounded batch.');
                    } else {
                      client.current?.start();
                      setNotice('Sampling by local random-site updates.');
                    }
                  }}
                >
                  {view.running ? 'Ⅱ Pause' : '▷ Run'}
                </button>
                <button
                  className="button"
                  disabled={
                    !snapshot || view.running || view.busy || !!view.error
                  }
                  onClick={() => client.current?.step()}
                >
                  Step
                </button>
                <button className="button" disabled={!snapshot} onClick={reset}>
                  Reset
                </button>
                <button
                  className="button"
                  disabled={!snapshot || view.running || view.busy}
                  onClick={() => void save(false)}
                >
                  Save current segment
                </button>
                <button
                  className="button"
                  disabled={!snapshot || view.running || view.busy}
                  onClick={() => void save(true)}
                >
                  Save available segments
                </button>
              </div>
              <div className="readout-grid">
                <p>
                  Retained <strong>{current?.samples ?? 0}</strong>
                </p>
                <p>
                  Segment updates <strong>{current?.updates ?? 0}</strong>
                </p>
                <p>
                  Warm-up{' '}
                  <strong>
                    {current?.warmupUpdates ?? 0}/
                    {(current?.settings.warmupSweeps ?? 0) * p.lx}
                  </strong>
                </p>
                <p>
                  Nominal sweeps <strong>{snapshot?.sweeps ?? 0}</strong>
                </p>
                <p>
                  Current m{' '}
                  <strong>
                    {snapshot
                      ? formatNumber(snapshot.magnetization / p.lx)
                      : '—'}
                  </strong>
                </p>
                <p>
                  Current e=H/N{' '}
                  <strong>
                    {snapshot ? formatNumber(snapshot.energy / p.lx) : '—'}
                  </strong>
                </p>
              </div>
              <p className="plot-note">
                One nominal sweep is N random-site updates with replacement.
                Updates are algorithmic, not physical time. Measurement stride
                and warm-up apply per segment.
              </p>
              <p role="status">{error ?? view.error ?? notice}</p>
            </section>
            {snapshot && (
              <ChainToolDeck
                snapshot={snapshot}
                selected={Math.min(selected, p.lx - 1)}
                select={setSelected}
              />
            )}
            <details className="technical-details">
              <summary>
                Three distinct transfer and transition operators
              </summary>
              <p>
                The spatial 2×2 Ising transfer matrix computes equilibrium Z and
                spatial ξ. The Monte Carlo transition matrix governs the
                sampler's update-time mixing and autocorrelation. The Euclidean
                QM transfer operator in Lattice QM describes quantum excitation
                energies. Their gaps are not interchangeable; none describes
                real-time dynamics here.
              </p>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
