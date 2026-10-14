import type { U1GaugeModel, Phase } from '../models/u1Gauge';
import {
  plaquetteAngles,
  plaquettePhases,
  u1GaugeTransform,
  u1Observables,
  wilsonAngle,
  wilsonPhase,
} from '../models/u1Gauge';
import type { U1Snapshot } from '../engine/u1GaugeRun';
import { u1Reference } from '../models/u1GaugeReference';
import { formatNumber as fmt } from '../plotting/PlotFrame';
import { GaugeCellGraph } from './GaugeCellGraph';
import { U1AngleHistogram, U1History } from './U1GaugePlots';
import type { ToolDefinition } from './ToolDeck';
import { DisplayMath } from '../ui/Math';

export const u1Tools = [
  {
    id: 'graph',
    title: 'Oriented U(1) links and plaquettes',
    kind: 'Visualization',
    description:
      'Four or eight independent circle-valued links, with explicit wrap arcs.',
  },
  {
    id: 'inspection',
    title: 'Complex plaquette and action',
    kind: 'Analysis',
    description: 'Gauge invariants now and separate full-segment estimates.',
  },
  {
    id: 'loops',
    title: 'Complex Wilson loops',
    kind: 'Analysis',
    description: 'Oriented walks, complex phases and principal angles.',
  },
  {
    id: 'transform',
    title: 'Continuous gauge transformation',
    kind: 'Analysis',
    description:
      'Preview a vertex phase, then apply at a paused acknowledged boundary.',
  },
  {
    id: 'reference',
    title: 'Bessel and character reference',
    kind: 'Analysis',
    description:
      'Normalized Haar measure and independently controlled numerical series.',
  },
  {
    id: 'distribution',
    title: 'Invariant angle distribution',
    kind: 'Plot',
    description:
      'Full-segment plaquette-angle histograms and the open exact density.',
  },
  {
    id: 'history',
    title: 'U(1) invariant history',
    kind: 'Plot',
    description:
      'Bounded measured history; algorithmic updates are not physical time.',
  },
  {
    id: 'winding',
    title: 'Continuous winding holonomies',
    kind: 'Analysis',
    description:
      'Fixed Wₓ/Wᵧ representatives; equilibrium Haar distribution, not conserved sectors.',
  },
  {
    id: 'transition',
    title: 'Latest angular Metropolis update',
    kind: 'Analysis',
    description:
      'Actual proposal, wrapped displacement, decision and warm-up-inclusive counts.',
  },
] as const satisfies readonly ToolDefinition<string>[];
export type U1ToolId = (typeof u1Tools)[number]['id'];
export type U1Selection = {
  edge: string;
  vertex: string;
  face: string;
  loop: string;
  alpha: string;
  preview: boolean;
  history: string;
};
export const initialU1Selection: U1Selection = {
  edge: 'e0',
  vertex: 'v0',
  face: 'f0',
  loop: 'f0',
  alpha: '1.2',
  preview: false,
  history: 'meanPlaquette',
};
export function phaseText(p: Phase): string {
  return `${fmt(p.re)} ${p.im < 0 ? '−' : '+'} ${fmt(Math.abs(p.im))} i`;
}
const walkText = (loop: U1GaugeModel['loops'][number]) =>
  loop.boundary.map((e) => `${e.sign === 1 ? '+' : '−'}${e.edgeId}`).join(' ');

/** All persistent selection belongs to the workspace; moving a tool never
 * changes a worker or loses the inspected link/loop. This renderer reads only
 * snapshots except for its explicit, guarded symmetry action. */
export function U1GaugeTool({
  id,
  model,
  snapshot,
  selection,
  select,
  ready,
  transform,
}: {
  id: U1ToolId;
  model: U1GaugeModel;
  snapshot: U1Snapshot | null;
  selection: U1Selection;
  select: (patch: Partial<U1Selection>) => void;
  ready: boolean;
  transform: (vertex: string, alpha: number) => void;
}) {
  const angles = snapshot?.angles ?? model.domain.edges.map(() => 0);
  const values = u1Observables(model, angles),
    faces = plaquettePhases(model, angles);
  const current = snapshot?.segments.at(-1),
    segments = snapshot?.segments ?? [];
  const selectedLoop =
    model.loops.find((l) => l.id === selection.loop) ?? model.loops[0]!;
  if (id === 'graph')
    return (
      <>
        <GaugeCellGraph
          model={model}
          edge={selection.edge}
          vertex={selection.vertex}
          face={selection.face}
          loop={selection.loop}
          selectEdge={(edge) => select({ edge })}
          selectVertex={(vertex) => select({ vertex, preview: false })}
          selectFace={(face) => select({ face, loop: face })}
          linkLabels={model.domain.edges.map((e) => e.id)}
          linkDetails={angles.map((a) => a.toFixed(1))}
          linkColors={angles.map(
            (a) => `hsl(${((a + Math.PI) * 360) / (2 * Math.PI)} 55% 35%)`,
          )}
          faceLabels={model.domain.faces.map(
            (f, i) => `${f.id}: ${phaseText(faces[i]!)}`,
          )}
          groupLabel={`${angles.length} independent oriented U(1) links`}
          note="Link labels are angles in radians, with phase color as a secondary cue."
        />
        <p data-testid="u1-link">
          Selected link {selection.edge}: θ=
          {fmt(angles[model.edgeIndex.get(selection.edge) ?? 0]!)} radians
          (gauge-variant coordinate).
        </p>
        <details>
          <summary>All link angles and orientations</summary>
          <table>
            <thead>
              <tr>
                <th>Link</th>
                <th>Orientation</th>
                <th>θ (rad)</th>
              </tr>
            </thead>
            <tbody>
              {model.domain.edges.map((e, i) => (
                <tr key={e.id}>
                  <td>
                    {e.id}
                    {e.wraps ? ' wrap' : ''}
                  </td>
                  <td>
                    {e.tail} → {e.head}
                  </td>
                  <td>{fmt(angles[i]!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </>
    );
  if (id === 'inspection')
    return (
      <>
        <p data-testid="u1-invariants">
          Current dimensionless S={fmt(values.action!)}; mean real plaquette=
          {fmt(values.meanPlaquette!)}.
        </p>
        <table aria-label="Current complex plaquettes">
          <thead>
            <tr>
              <th>Face</th>
              <th>U_f</th>
              <th>θ_f (rad)</th>
            </tr>
          </thead>
          <tbody>
            {model.domain.faces.map((f, i) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{phaseText(faces[i]!)}</td>
                <td>{fmt(plaquetteAngles(model, angles)[i]!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Selected face {selection.face}:{' '}
          {walkText(model.loops.find((l) => l.id === selection.face)!)}.
        </p>
        <table aria-label="U(1) parameter segments">
          <thead>
            <tr>
              <th>Segment / K</th>
              <th>Samples</th>
              <th>Mean Re P</th>
              <th>Mean S</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.id} / {s.settings.K}
                </td>
                <td>{s.samples}</td>
                <td>{fmt(s.samples ? s.moments.meanPlaquette!.mean : null)}</td>
                <td>{fmt(s.samples ? s.moments.action!.mean : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="plot-note">
          Full-segment complex moments use cos/sin, never arithmetic mean
          angles. No independent-sample error bars are assigned to the local
          chain.{' '}
          {model.geometry === 'torus' &&
            'The product of four plaquette phases is one; the sum of their principal angles may be a nonzero multiple of 2π.'}
        </p>
      </>
    );
  if (id === 'loops') {
    const p = wilsonPhase(model, angles, selectedLoop.boundary);
    return (
      <>
        <label>
          Inspected U(1) Wilson loop
          <select
            value={selectedLoop.id}
            onChange={(e) => select({ loop: e.target.value })}
          >
            {model.loops.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <p data-testid="u1-loop">
          {walkText(selectedLoop)}; W={phaseText(p)}; principal angle=
          {fmt(wilsonAngle(model, angles, selectedLoop.boundary))} rad.
        </p>
        <p>
          Reverse transport is complex conjugation. The two-face walk gives U_f0
          U_f1, with opposite connector traversals cancelling by inversion;
          Re(W) is cos(θ_f0+θ_f1), not cos(θ_f0)cos(θ_f1).
        </p>
        <p className="plot-note">
          The lifted two-face rectangle is contractible; its torus projection
          self-touches. Fixed winding representatives can differ from parallel
          representatives by curvature. Gauge transformations preserve all
          closed holonomies; local updates may change them.
        </p>
      </>
    );
  }
  if (id === 'transform') {
    const alpha = Number(selection.alpha),
      valid =
        selection.alpha.trim() !== '' &&
        Number.isFinite(alpha) &&
        Math.abs(alpha) <= Math.PI;
    const after = valid
      ? u1GaugeTransform(model, angles, { [selection.vertex]: alpha })
      : null;
    const transformedValues = after ? u1Observables(model, after) : null;
    return (
      <>
        <label>
          U(1) transformation vertex
          <select
            value={selection.vertex}
            onChange={(e) => select({ vertex: e.target.value, preview: false })}
          >
            {model.domain.vertices.map((v) => (
              <option key={v.id}>{v.id}</option>
            ))}
          </select>
        </label>
        <label>
          Vertex phase α (radians)
          <input
            type="number"
            min={-Math.PI}
            max={Math.PI}
            step="any"
            value={selection.alpha}
            onChange={(e) => select({ alpha: e.target.value, preview: false })}
          />
        </label>
        {!valid && <p>Use a finite α in [−π,π].</p>}
        <button
          disabled={!ready || !valid}
          onClick={() => select({ preview: true })}
        >
          Preview U(1) transformation
        </button>
        {selection.preview && after && transformedValues && (
          <div data-testid="u1-preview">
            <table>
              <thead>
                <tr>
                  <th>Link</th>
                  <th>Before θ</th>
                  <th>After θ</th>
                </tr>
              </thead>
              <tbody>
                {model.domain.edges.map((e, i) => (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td>{fmt(angles[i]!)}</td>
                    <td>{fmt(after[i]!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Gauge-invariant action {fmt(values.action!)} →{' '}
              {fmt(transformedValues.action!)}.
            </p>
            <table aria-label="Gauge invariants before and after">
              <thead>
                <tr>
                  <th>Loop</th>
                  <th>Before W</th>
                  <th>After W</th>
                </tr>
              </thead>
              <tbody>
                {model.loops.map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td>{phaseText(wilsonPhase(model, angles, l.boundary))}</td>
                    <td>{phaseText(wilsonPhase(model, after, l.boundary))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              disabled={!ready}
              onClick={() => transform(selection.vertex, alpha)}
            >
              Apply U(1) vertex transformation
            </button>
          </div>
        )}
        <p className="plot-note">
          Unchanged invariants up to roundoff. Apply requires a paused
          acknowledged worker. This deterministic symmetry consumes no random
          numbers, updates or measurements and creates no segment.
        </p>
      </>
    );
  }
  if (id === 'reference') {
    const reference = u1Reference(model.geometry, model.K),
      v = reference.values;
    const means: Record<string, number> = {};
    if (v) {
      means.meanPlaquette = v.meanPlaquette;
      means.action = v.action;
      for (const l of model.loops) {
        means[`${l.id}.re`] = l.winding
          ? 0
          : l.id === 'pair'
            ? v.pair!
            : v.meanPlaquette;
        means[`${l.id}.im`] = 0;
      }
    }
    return (
      <>
        <DisplayMath>
          {model.geometry === 'square'
            ? String.raw`Z=I_0(K),\quad\langle U_f\rangle=I_1(K)/I_0(K)`
            : String.raw`Z=\sum_{n\in\mathbb Z}I_n(K)^4`}
        </DisplayMath>
        <p data-testid="u1-reference">
          Numerical series: {reference.status}. {reference.reason}{' '}
          {v && `Normalized-Haar Z=${fmt(v.Z)}; log Z=${fmt(v.logZ)}.`}
        </p>
        {reference.error && (
          <p className="plot-note">
            Error allowance: relative Z ≤{' '}
            {reference.error.partitionRelative.toExponential(2)}; absolute
            plaquette ≤ {reference.error.plaquette.toExponential(2)}; two-face
            loop ≤ {reference.error.pair.toExponential(2)}. Tail bounds plus
            floating-point allowance, not formal interval arithmetic.
          </p>
        )}
        <table aria-label="U(1) reference comparison">
          <thead>
            <tr>
              <th>Invariant</th>
              <th>Reference mean</th>
              <th>Sampled current segment</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(means).map(([key, x]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{fmt(x)}</td>
                <td>
                  {fmt(current?.samples ? current.moments[key]!.mean : null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Exact analytical formulas, numerically evaluated with controlled
          series. Normalized Haar gives Z(0)=1: no 16/256 counting factor, no
          (2π)^E and no gauge fixing. For real K, imaginary expectations vanish
          by conjugation symmetry; finite samples need not.
        </p>
      </>
    );
  }
  if (id === 'distribution')
    return (
      <>
        <label>
          Histogram face
          <select
            value={selection.face}
            onChange={(e) => select({ face: e.target.value })}
          >
            {model.domain.faces.map((f) => (
              <option key={f.id}>{f.id}</option>
            ))}
          </select>
        </label>
        <U1AngleHistogram segments={segments} loop={selection.face} />
      </>
    );
  if (id === 'history')
    return (
      <>
        <label>
          History invariant
          <select
            value={selection.history}
            onChange={(e) => select({ history: e.target.value })}
          >
            {Object.keys(values)
              .filter((key) => key !== 'action')
              .map((key) => (
                <option key={key}>{key}</option>
              ))}
          </select>
        </label>
        <U1History segments={segments} observable={selection.history} />
      </>
    );
  if (id === 'winding')
    return model.geometry === 'square' ? (
      <p>
        The open square has no noncontractible winding loops. Select the
        periodic torus.
      </p>
    ) : (
      <>
        {(['wx', 'wy'] as const).map((key) => (
          <div key={key}>
            <p>
              {key === 'wx' ? 'Wₓ: +e0 +e2' : 'Wᵧ: +e1 +e5'}; current{' '}
              {phaseText({
                re: values[`${key}.re`]!,
                im: values[`${key}.im`]!,
              })}
              ; principal angle{' '}
              {fmt(
                wilsonAngle(
                  model,
                  angles,
                  model.loops.find((l) => l.id === key)!.boundary,
                ),
              )}{' '}
              rad.
            </p>
            <U1AngleHistogram segments={segments} loop={key} />
          </div>
        ))}
        <p>
          Global flat holonomies are Haar distributed at equilibrium, with zero
          real/imaginary means. These are continuous phases, not four Z₂ winding
          signs. Agreement in plaquette statistics alone does not demonstrate
          exploration of these directions; they are not conserved by Metropolis.
        </p>
      </>
    );
  const event = snapshot?.event;
  return (
    <div data-testid="u1-transition">
      <p>
        {event
          ? event.kind
          : 'Unmeasured all-zero angle starting configuration.'}
      </p>
      {event && event.kind !== 'gauge-transform' && (
        <>
          <p>
            Selected link {event.edgeId}: θ={fmt(event.before)}, displacement=
            {fmt(event.displacement)}, proposed canonical θ=
            {fmt(event.proposed)} rad. Crossing ±π is coordinate wrapping, not a
            discontinuity of U.
          </p>
          <p>
            Proposed ΔS={fmt(event.proposedDelta)}; actual ΔS=
            {fmt(event.actualDelta)}. Acceptance probability=
            {fmt(event.probability)}.
          </p>
          <p>
            Three uniforms (link, displacement, decision):{' '}
            {event.uniforms.map(fmt).join(', ')}.
          </p>
        </>
      )}
      {event?.kind === 'gauge-transform' && (
        <p>
          Vertex {event.vertex}, α={fmt(event.alpha)} radians. Deterministic
          representation change, not a Monte Carlo proposal.
        </p>
      )}
      <p>
        Including warm-up: {current?.accepted ?? 0} accepted,{' '}
        {current?.rejected ?? 0} rejected. Acceptance{' '}
        {current?.updates
          ? `${fmt((100 * current.accepted) / current.updates)}%`
          : 'awaiting proposals'}
        . No automatic width adaptation.
      </p>
    </div>
  );
}
