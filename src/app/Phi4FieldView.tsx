import { useState } from 'react';
import { defaultPhi4Configuration } from '../engine/fieldRun';
import type {
  Phi4FieldConfiguration,
  Phi4FieldSettings,
} from '../engine/fieldRun';
import { createFieldLattice } from '../domain/fieldLattice';
import { formatNumber as f } from '../plotting/PlotFrame';
import { SiteHeader } from './SiteHeader';
import { useField } from './useField';
import { RunPauseControl } from './RunPauseControl';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';
import { FieldVisual } from './FieldVisual';
import { FieldStepInspection } from './FieldResults';
import { FieldHistory } from './FieldHistory';
import { Phi4FieldControls } from './Phi4FieldControls';
import { Phi4Reference } from './Phi4Reference';
import {
  Phi4LocalInspection,
  Phi4SpatialCorrelations,
  Phi4Moments,
} from './Phi4FieldTools';
import type { Phi4Segment as Segment } from './Phi4FieldTools';

type Tool =
  | 'field'
  | 'correlations'
  | 'local'
  | 'history'
  | 'transition'
  | 'moments'
  | 'reference';
const tools: ToolDefinition<Tool>[] = [
  {
    id: 'field',
    title: 'Current spatial field',
    kind: 'Visualization',
    description: 'Controlled profile or heatmap.',
  },
  {
    id: 'correlations',
    title: 'Spatial correlations',
    kind: 'Plot',
    description: 'Full-segment x/y pair averages.',
  },
  {
    id: 'local',
    title: 'Selected-site interactions',
    kind: 'Analysis',
    description: 'On-site, incident bonds and fixed-neighbor conditional.',
  },
  {
    id: 'history',
    title: 'Selected-site history',
    kind: 'Plot',
    description: 'Bounded retained measurements.',
  },
  {
    id: 'transition',
    title: 'Local Metropolis inspection',
    kind: 'Analysis',
    description: 'Actual latest proposal and decision.',
    featureable: false,
  },
  {
    id: 'moments',
    title: 'Scalar moments and acceptance',
    kind: 'Analysis',
    description: 'Full-segment summaries and Binder ratio.',
    featureable: false,
  },
  {
    id: 'reference',
    title: 'Independent spatial reference',
    kind: 'Analysis',
    description: 'Gaussian, decoupled or lazy periodic transfer.',
  },
];

/** Model switching remounts the session (as in QM). All tools merely project
 * acknowledged snapshots; keyed ranges and shared site selection belong here. */
export function Phi4FieldView({
  chooseGaussian,
}: {
  chooseGaussian: () => void;
}) {
  const { view, client } = useField(defaultPhi4Configuration);
  const [draft, setDraft] = useState<Phi4FieldConfiguration>(
    defaultPhi4Configuration,
  );
  const [seed, setSeed] = useState(String(defaultPhi4Configuration.seed));
  const [selected, setSelected] = useState(0);
  const [ranges, setRanges] = useState<Record<number, number>>({});
  const [notice, setNotice] = useState(
    'The initial zero field is not an equilibrium draw.',
  );
  const [error, setError] = useState<string | null>(null);
  const snapshot = view.snapshot;
  const segments =
    snapshot?.segments.filter(
      (s): s is Segment => s.settings.model === 'phi4-field',
    ) ?? [];
  const current = segments.at(-1),
    applied = current?.settings ?? defaultPhi4Configuration,
    p = applied.parameters;
  const lattice = createFieldLattice(p.shape),
    site = Math.min(selected, lattice.size - 1);
  const busy = view.busy || !current;
  function attempt(action: () => void, message: string) {
    try {
      action();
      setError(null);
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Invalid spatial settings.',
      );
    }
  }
  function apply() {
    const changed =
      JSON.stringify(draft.parameters.shape) !== JSON.stringify(p.shape);
    const settings: Phi4FieldSettings = {
      model: 'phi4-field',
      parameters: draft.parameters,
      sampler: draft.sampler,
      warmupSweeps: draft.warmupSweeps,
      strideSweeps: draft.strideSweeps,
    };
    attempt(
      () => {
        if (changed) {
          client.current?.initialize({ ...settings, seed: Number(seed) });
          setSelected(0);
        } else client.current?.change(settings);
      },
      changed
        ? 'Geometry changed: a new seeded session began.'
        : 'Applied settings begin an isolated segment; field and RNG continue, with fresh warm-up.',
    );
  }
  function siteControl() {
    return (
      <label className="tool-options">
        Selected spatial site
        <input
          aria-label="Selected spatial site"
          type="number"
          min="0"
          max={lattice.size - 1}
          step="1"
          value={site}
          onChange={(e) => {
            const value = e.target.valueAsNumber;
            if (Number.isInteger(value) && value >= 0 && value < lattice.size)
              setSelected(value);
          }}
        />
      </label>
    );
  }
  function rangeControl(key: number) {
    return (
      <label className="tool-options">
        Fixed field range ±
        <input
          aria-label="Spatial field range"
          type="number"
          min="0.1"
          max="100"
          step="any"
          value={ranges[key] ?? 3}
          onChange={(e) => {
            const value = e.target.valueAsNumber;
            if (value >= 0.1 && value <= 100)
              setRanges((old) => ({ ...old, [key]: value }));
          }}
        />
      </label>
    );
  }
  const average = snapshot?.field
    ? snapshot.field.reduce((sum, v) => sum + v, 0) / lattice.size
    : null;
  return (
    <>
      <a className="skip-link" href="#field-laboratory">
        Skip to field laboratory
      </a>
      <SiteHeader active="fields" />
      <main id="field-laboratory">
        <section className="intro" id="fields-paths">
          <div>
            <p className="eyebrow">A numerical playground / 04</p>
            <h1>
              Interacting spatial fields. <span>Finite-volume φ⁴.</span>
            </h1>
            <p className="intro-copy">
              Explore single and double wells, spatial correlations and
              independently checked references on small 1D and 2D lattices.
            </p>
          </div>
          <span className="milestone">M4d1 · Spatial φ⁴</span>
        </section>
        <div className="qm-model-choice">
          <label>
            Field model{' '}
            <select
              aria-label="Field model"
              value="phi4"
              onChange={chooseGaussian}
            >
              <option value="gaussian">Gaussian field / mean-zero GFF</option>
              <option value="phi4">Interacting φ⁴ field</option>
            </select>
          </label>
          <span className="plot-note">
            Changing model starts a new seeded session.
          </span>
        </div>
        <div className="lab-layout field-layout">
          <Phi4FieldControls
            applied={applied}
            draft={draft}
            setDraft={setDraft}
            seed={seed}
            setSeed={setSeed}
            apply={apply}
          />
          <div className="field-main">
            <section
              className="field-run-panel"
              aria-label="Spatial quartic simulation controls"
            >
              <div className="section-heading">
                <h2>Spatial interacting field</h2>
                <span className="parameter-chip">
                  {lattice.size} sites · {lattice.bonds.length} bonds
                </span>
              </div>
              <div className="field-run-buttons">
                <RunPauseControl
                  running={view.running}
                  busy={view.busy}
                  ready={!!current && !view.error}
                  run={() => client.current?.start()}
                  pause={() => client.current?.pause()}
                />
                <button
                  className="button"
                  type="button"
                  disabled={busy || view.running || !!view.error}
                  onClick={() => client.current?.step()}
                >
                  Step
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={!current}
                  onClick={() =>
                    attempt(
                      () =>
                        client.current?.initialize({
                          ...applied,
                          seed: Number(seed),
                        }),
                      'Reset cleared measurements and restarted the applied model with the selected seed.',
                    )
                  }
                >
                  Reset
                </button>
              </div>
              <div className="field-run-readings">
                <span>
                  Updates{' '}
                  <strong data-testid="phi4-updates">
                    {snapshot?.updates ?? 0}
                  </strong>
                </span>
                <span>
                  Nominal sweeps{' '}
                  <strong>{f((snapshot?.updates ?? 0) / lattice.size)}</strong>
                </span>
                <span>
                  Retained fields{' '}
                  <strong data-testid="phi4-samples">
                    {current?.measurements ?? 0}
                  </strong>
                </span>
                <span>
                  Segment{' '}
                  <strong data-testid="phi4-segment">
                    {current?.id ?? '—'}
                  </strong>
                </span>
                <span>
                  Current m <strong>{f(average)}</strong>
                </span>
                <span>
                  Current S/V{' '}
                  <strong>
                    {f(
                      snapshot?.action === null || !snapshot
                        ? null
                        : snapshot.action / lattice.size,
                    )}
                  </strong>
                </span>
              </div>
              <p
                className="run-notice"
                role={error || view.error ? 'alert' : undefined}
              >
                {error || view.error || notice}
              </p>
              <p className="plot-note">
                One Step attempts one site with replacement; {lattice.size}{' '}
                attempts make a nominal sweep. Algorithmic updates are not
                physical time. Fixed warm-up does not guarantee mixing.
              </p>
            </section>
            <ToolDeck
              title="Spatial φ⁴ tools"
              tools={tools}
              featuredDefault="field"
              defaults={['correlations', 'local']}
              onRemove={(key) =>
                setRanges((old) => {
                  const next = { ...old };
                  delete next[key];
                  return next;
                })
              }
              renderTool={(tool, key) => {
                if (!snapshot || !current)
                  return <p>Waiting for the field worker…</p>;
                if (tool === 'field')
                  return (
                    <>
                      {siteControl()}
                      {rangeControl(key)}
                      <FieldVisual
                        shape={p.shape}
                        field={snapshot.field}
                        selected={site}
                        onSelect={setSelected}
                        limit={ranges[key] ?? 3}
                      />
                    </>
                  );
                if (tool === 'history')
                  return (
                    <>
                      {siteControl()}
                      {rangeControl(key)}
                      <FieldHistory
                        snapshot={snapshot}
                        site={site}
                        limit={ranges[key] ?? 3}
                      />
                    </>
                  );
                if (tool === 'transition')
                  return <FieldStepInspection snapshot={snapshot} />;
                if (tool === 'reference')
                  return <Phi4Reference p={p} segment={current} />;
                if (tool === 'moments')
                  return <Phi4Moments segments={segments} />;
                if (tool === 'local')
                  return (
                    <Phi4LocalInspection
                      lattice={lattice}
                      p={p}
                      field={snapshot.field}
                      site={site}
                      siteControl={siteControl()}
                    />
                  );
                return (
                  <Phi4SpatialCorrelations
                    segments={segments}
                    current={current}
                  />
                );
              }}
            />
            <details className="model-page-details">
              <summary>Technical details &amp; measurement coverage</summary>
              <p>
                Seed {snapshot?.seed ?? seed}; {current?.warmupUpdates ?? 0}{' '}
                warm-up updates. Up to eight isolated segments and 256 recent
                field vectors per segment. Full-segment site, m, m², m⁴, S/V and
                pair-product aggregates survive vector eviction.{' '}
                {snapshot?.droppedSegments ?? 0} older segments dropped.
              </p>
              <p>
                No archive or sweep format is changed. Local-chain estimates can
                have long autocorrelation and metastability.
              </p>
            </details>
            <details className="model-page-details">
              <summary>
                Mathematics, exercises &amp; suggested experiments
              </summary>
              <p>
                Compare an open two-site chain with its two-bond periodic
                counterpart. Set λ=0 to recover the exact Gaussian measure, or
                κ=0 to factor independent quartic sites. For a periodic chain
                set a=1/κ and (rQM,λQM,hQM)=(r,λ,j)/a to obtain precisely the
                same QM action. The spatial coordinate remains distinct from
                Euclidean time.
              </p>
              <p>
                Negative r creates bare double wells when j=0; finite-volume
                reflection symmetry still gives zero equilibrium mean. A trapped
                chain is not evidence of symmetry breaking or a 2D phase
                transition.
              </p>
              <a href="https://github.com/gantemur/lattice/blob/main/docs/math/spatial-phi4.md">
                Spatial φ⁴ mathematics ↗
              </a>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
