import type { PottsModel } from '../models/potts';
import { pottsConditional, pottsObservables } from '../models/potts';
import {
  exactPotts,
  pottsStateCount,
  pottsTriangleReference,
} from '../models/pottsExact';
import type { PottsSnapshot, PottsSegment } from '../engine/pottsRun';
import { formatNumber as fmt } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';
import { DisplayMath } from '../ui/Math';
import { PottsConfigurationView, pottsColors } from './PottsConfiguration';
import type { ToolDefinition } from './ToolDeck';
export const pottsTools = [
  {
    id: 'configuration',
    title: 'Categorical configuration',
    kind: 'Visualization',
    description: 'Select actual sites and physical bonds.',
  },
  {
    id: 'conditional',
    title: 'Selected-site conditional',
    kind: 'Analysis',
    description:
      'Fixed neighbors, categorical probabilities and current bond agreement.',
  },
  {
    id: 'reference',
    title: 'Exact finite-volume reference',
    kind: 'Analysis',
    description: 'Counting-measure enumeration only where q^V≤256.',
  },
  {
    id: 'occupation',
    title: 'Color occupation',
    kind: 'Plot',
    description: 'Full-segment fractions and selected-site occupancy.',
  },
  {
    id: 'measurements',
    title: 'Order, action and agreement',
    kind: 'Analysis',
    description: 'Separate full-segment scientific estimates.',
  },
  {
    id: 'history',
    title: 'Order-parameter history',
    kind: 'Plot',
    description: 'Actual bounded measurements, not physical time.',
  },
  {
    id: 'correlation',
    title: 'Pair equality and spatial correlations',
    kind: 'Plot',
    description: 'Raw equality/overlap, without spatial demeaning.',
  },
  {
    id: 'transition',
    title: 'Latest Potts update',
    kind: 'Analysis',
    description: 'Actual draw, proposal or resample with uniform budget.',
  },
  {
    id: 'ising',
    title: 'q=2 Ising correspondence',
    kind: 'Analysis',
    description: 'Action and partition shifts, including every physical bond.',
  },
] as const satisfies readonly ToolDefinition<string>[];
export type PottsToolId = (typeof pottsTools)[number]['id'];
export function PottsTool({
  id,
  model,
  snapshot,
  site,
  bond,
  color,
  compare,
  history,
  selectSite,
  selectBond,
  selectColor,
  selectCompare,
  selectHistory,
}: {
  id: PottsToolId;
  model: PottsModel;
  snapshot: PottsSnapshot | null;
  site: number;
  bond: string;
  color: number;
  compare: number;
  history: string;
  selectSite: (i: number) => void;
  selectBond: (id: string) => void;
  selectColor: (c: number) => void;
  selectCompare: (i: number) => void;
  selectHistory: (key: string) => void;
}) {
  const state = snapshot?.colors ?? new Uint8Array(model.size),
    current = snapshot?.segments.at(-1),
    segments = snapshot?.segments ?? [];
  const exact = pottsStateCount(model) !== null ? exactPotts(model) : null;
  if (id === 'configuration')
    return (
      <PottsConfigurationView
        {...{ model, snapshot, site, bond, selectSite, selectBond }}
      />
    );
  if (id === 'conditional') {
    const probabilities = pottsConditional(model, state, site),
      edge = model.bonds.find((b) => b.id === bond);
    return (
      <>
        <label>
          Conditional Potts site
          <input
            type="number"
            min="0"
            max={model.size - 1}
            value={site}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n < model.size)
                selectSite(n);
            }}
          />
        </label>
        <p>
          Site {site}, current color {state[site]}; distinguished-color source
          h={model.h}.
        </p>
        <table aria-label="Potts conditional probabilities">
          <thead>
            <tr>
              <th>Color</th>
              <th>Conditional probability</th>
              <th>Exact marginal</th>
            </tr>
          </thead>
          <tbody>
            {probabilities.map((p, c) => (
              <tr key={c}>
                <td>{c}</td>
                <td>{fmt(p)}</td>
                <td>{fmt(exact?.siteProbabilities[site]?.[c] ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="plot-note">
          Fixed-neighbor conditionals are not equilibrium marginals. Self-links
          add constant action and no local score.
        </p>
        <ul>
          {model.incident[site]!.map(({ bond: b, neighbor }) => (
            <li key={b}>
              {model.bonds[b]!.id}: neighbor {neighbor}, color {state[neighbor]}
              , K={model.bonds[b]!.K}
            </li>
          ))}
        </ul>
        <p data-testid="potts-bond">
          {edge
            ? `Bond ${edge.id}: ${edge.tail} → ${edge.head}${edge.wraps ? ' wrap' : ''}; K=${edge.K}; agreement δ=${Number(state[edge.tail] === state[edge.head])}; action ${fmt(-edge.K * Number(state[edge.tail] === state[edge.head]))}.`
            : 'No physical bond on this geometry.'}
        </p>
      </>
    );
  }
  if (id === 'reference')
    return (
      <>
        {exact ? (
          <>
            <p data-testid="potts-exact">
              Exact finite enumeration: {exact.states.length} configurations;
              log Z={fmt(exact.logPartition)}; probability sum=
              {fmt(exact.probabilities.reduce((s, p) => s + p, 0))}.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Observable</th>
                  <th>Exact</th>
                  <th>Current segment estimate</th>
                </tr>
              </thead>
              <tbody>
                {['m0', 'majority', 'action', 'actionDensity', 'agreement']
                  .filter((key) => key in exact.means)
                  .map((key) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{fmt(exact.means[key]!)}</td>
                      <td>
                        {fmt(
                          current?.samples ? current.moments[key]!.mean : null,
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <details>
              <summary>First 16 exact categorical configurations</summary>
              <table>
                <thead>
                  <tr>
                    <th>Colors by site</th>
                    <th>Probability</th>
                    <th>S</th>
                  </tr>
                </thead>
                <tbody>
                  {exact.states.slice(0, 16).map((s, i) => (
                    <tr key={i}>
                      <td>{Array.from(s).join(', ')}</td>
                      <td>{fmt(exact.probabilities[i]!)}</td>
                      <td>{fmt(exact.actions[i]!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Showing {Math.min(16, exact.states.length)} of{' '}
                {exact.states.length}; all states enter exact statistics and
                direct draws.
              </p>
            </details>
          </>
        ) : (
          <p data-testid="potts-exact">
            Exact enumeration unavailable: q^V exceeds 256. Local sampling does
            not provide an exact partition function.
          </p>
        )}
        <p>
          Counting measure: q^V states at K=h=0. Local-chain samples are
          correlated; no independent-sample error bars are assigned.
        </p>
        {model.graph?.id === 'triangle' &&
          model.h === 0 &&
          model.bonds.every((b) => b.K < 0) && (
            <p data-testid="potts-frustration">
              For equal antiferromagnetic bonds: q={model.q} has{' '}
              {pottsTriangleReference(model.q, -1).groundStates} ground
              configurations and{' '}
              {pottsTriangleReference(model.q, -1).minimumAgreements} agreeing
              bonds at the minimum. q=2 is frustrated; q=3 has six proper
              three-colorings, q=4 has 24. Unequal bonds can split the
              degeneracy. This is finite-graph counting, not a phase transition.
            </p>
          )}
      </>
    );
  if (id === 'occupation')
    return (
      <>
        <label>
          Inspected Potts color
          <select
            value={color}
            onChange={(e) => selectColor(Number(e.target.value))}
          >
            {Array.from({ length: model.q }, (_, c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <svg
          viewBox="0 0 440 220"
          role="img"
          aria-label="Potts color fraction comparison"
        >
          {Array.from({ length: model.q }, (_, c) => {
            const x = 35 + (c * 390) / model.q,
              w = 250 / model.q,
              mean = current?.samples ? current.moments[`p${c}`]!.mean : null;
            return (
              <g key={c}>
                {mean !== null && (
                  <rect
                    x={x}
                    y={180 - 150 * mean}
                    width={w}
                    height={150 * mean}
                    fill={pottsColors[c]}
                  />
                )}{' '}
                {exact && (
                  <line
                    x1={x - 3}
                    x2={x + w + 3}
                    y1={180 - 150 * exact.means[`p${c}`]!}
                    y2={180 - 150 * exact.means[`p${c}`]!}
                    stroke="#222"
                    strokeWidth="2"
                  />
                )}
                <text x={x} y="205" fontSize="14">
                  Color {c}
                </text>
              </g>
            );
          })}
          <text x="15" y="17" fontSize="12">
            Fraction 0–1; bars sampled, line exact
          </text>
        </svg>
        <table>
          <thead>
            <tr>
              <th>Segment</th>
              <th>Color {color} fraction</th>
              <th>Site {site} occupancy</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{fmt(s.samples ? s.moments[`p${color}`]!.mean : null)}</td>
                <td>
                  {fmt(
                    s.samples ? s.occupancy[site]![color]! / s.samples : null,
                  )}
                </td>
                <td>{s.samples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  if (id === 'measurements') {
    const v = pottsObservables(model, state);
    return (
      <>
        <p data-testid="potts-current">
          Current m₀={fmt(v.m0!)}, majority={fmt(v.majority!)}, dimensionless
          S/V={fmt(v.actionDensity!)}.
        </p>
        <table aria-label="Potts segment measurements">
          <thead>
            <tr>
              <th>Segment</th>
              <th>N</th>
              <th>m₀</th>
              <th>Majority</th>
              <th>S/V</th>
              <th>Agreement</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.samples}</td>
                {['m0', 'majority', 'actionDensity', 'agreement'].map((key) => (
                  <td key={key}>
                    {fmt(s.samples ? (s.moments[key]?.mean ?? null) : null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          m₀=(q p₀−1)/(q−1); majority=(q max pₐ−1)/(q−1). Finite uncorrelated
          systems generally have positive mean majority order. S/V is
          dimensionless action density, not physical Ising energy.
        </p>
      </>
    );
  }
  if (id === 'history')
    return (
      <>
        <label>
          Potts history observable
          <select
            value={history}
            onChange={(e) => selectHistory(e.target.value)}
          >
            {['m0', 'majority', 'actionDensity', 'agreement']
              .filter((key) => key in pottsObservables(model, state))
              .map((key) => (
                <option key={key}>{key}</option>
              ))}
          </select>
        </label>
        <PottsHistory segments={segments} observable={history} />
      </>
    );
  if (id === 'correlation')
    return (
      <>
        {model.shape ? (
          <>
            {(['spatialX', 'spatialY'] as const).map((axis) => (
              <div key={axis}>
                <p>
                  {axis === 'spatialX' ? 'x' : 'y'} direction: finite-volume
                  admissible-origin averages
                </p>
                <svg
                  viewBox="0 0 440 190"
                  role="img"
                  aria-label={`Potts ${axis} equality correlation`}
                >
                  <line x1="30" x2="420" y1="150" y2="150" stroke="#777" />
                  {segments
                    .filter((s) => s.samples)
                    .map((s) => (
                      <polyline
                        key={s.id}
                        fill="none"
                        stroke={segmentColor(s.id)}
                        strokeWidth="2"
                        points={s[axis]
                          .map(
                            (v) =>
                              `${30 + (380 * v.r) / Math.max(1, s[axis].length - 1)},${150 - 120 * v.moments.mean}`,
                          )
                          .join(' ')}
                      />
                    ))}
                  <text x="30" y="18" fontSize="12">
                    C_same(r) ∈ [0,1]
                  </text>
                  <text x="30" y="178" fontSize="12">
                    r=0 … {current?.[axis].at(-1)?.r ?? 0} lattice spacings
                  </text>
                </svg>
                <table>
                  <thead>
                    <tr>
                      <th>r</th>
                      <th>Pairs</th>
                      <th>Sampled C_same</th>
                      <th>Raw Gq</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current?.[axis].map((v) => (
                      <tr key={v.r}>
                        <td>{v.r}</td>
                        <td>{v.pairs}</td>
                        <td>{fmt(current.samples ? v.moments.mean : null)}</td>
                        <td>
                          {fmt(
                            current.samples
                              ? (model.q * v.moments.mean - 1) / (model.q - 1)
                              : null,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        ) : (
          <>
            <label>
              Potts comparison site
              <input
                type="number"
                min="0"
                max={model.size - 1}
                value={compare}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  if (Number.isInteger(i) && i >= 0 && i < model.size)
                    selectCompare(i);
                }}
              />
            </label>
            <p>
              Sites {site}, {compare}: exact equality{' '}
              {fmt(exact?.pairs[site]?.[compare] ?? null)}; sampled{' '}
              {fmt(
                current?.samples
                  ? current.pairCounts![site]![compare]! / current.samples
                  : null,
              )}
              .
            </p>
          </>
        )}
        <p>
          Gq=(q C_same−1)/(q−1) is a raw overlap. For q=2 it equals raw Ising
          ⟨sᵢsⱼ⟩, not connected covariance at nonzero source. Open/mixed boxes
          use origin averages; no spatial demeaning, mass gap or
          correlation-length fit.
        </p>
        {segments.map((s) => (
          <p
            className="plot-note"
            key={s.id}
            style={{ color: segmentColor(s.id) }}
          >
            Segment {s.id}: {s.samples} complete measurements, source{' '}
            {s.settings.parameters.h}.
          </p>
        ))}
      </>
    );
  if (id === 'ising')
    return (
      <>
        <DisplayMath>{String.raw`S_P=S_I-\tfrac12\sum_bK_b-\tfrac12Vh,\qquad \log Z_P=\log Z_I+\tfrac12\sum_bK_b+\tfrac12Vh`}</DisplayMath>
        <p>
          {model.q === 2
            ? 'Applicable at q=2.'
            : 'Select q=2 for this correspondence.'}{' '}
          Color 0 ↔ +1, color 1 ↔ −1; Ising J_b=K_b/2 and b_i=h/2. For physical
          lattice Ising use T=1. m₀ is signed Ising magnetization; majority is
          |m|.
        </p>
        <p>
          Current constant shift C=(ΣK+Vh)/2=
          {fmt(
            (model.bonds.reduce((s, b) => s + b.K, 0) + model.size * model.h) /
              2,
          )}
          ; {model.bonds.length} physical bonds. For q=2, S_Ising=S_P+C
          {model.q === 2 && exact
            ? `; log Z_Ising=${fmt(exact.logPartition - (model.bonds.reduce((s, b) => s + b.K, 0) + model.size * model.h) / 2)}`
            : ''}
          .
        </p>
      </>
    );
  const trace = snapshot?.trace;
  return (
    <div data-testid="potts-transition">
      <p>
        {trace
          ? `${trace.sampler}: ${trace.outcome}`
          : 'Unmeasured all-color-0 initialization.'}
      </p>
      {trace && (
        <>
          <p>
            Site {trace.site ?? 'whole configuration'}; before{' '}
            {trace.before ?? '—'}, proposed {trace.proposed ?? '—'}, result{' '}
            {trace.after ?? '—'}. Proposed/resampled ΔS={fmt(trace.delta)},
            actual ΔS={fmt(trace.actualDelta)}.
          </p>
          <p>
            Uniforms ({trace.uniforms.length}):{' '}
            {trace.uniforms.map(fmt).join(', ')}.
          </p>
          <p>
            {trace.sampler === 'metropolis'
              ? `Acceptance probability ${fmt(trace.probability)}.`
              : trace.sampler === 'direct'
                ? 'Acceptance N/A: exact independent whole-state draw.'
                : 'Acceptance N/A: heat bath resamples the categorical conditional, including unchanged outcomes.'}
          </p>
        </>
      )}
      {current && (
        <>
          <p>
            Including warm-up:{' '}
            {Object.entries(current.outcomes)
              .map(([key, count]) => `${key} ${count}`)
              .join('; ')}
            .
          </p>
          {current.settings.sampler === 'metropolis' && (
            <p>
              Recoloring acceptance{' '}
              {fmt(
                current.outcomes.accepted + current.outcomes.rejected
                  ? (100 * current.outcomes.accepted) /
                      (current.outcomes.accepted + current.outcomes.rejected)
                  : null,
              )}
              %; intentional self-proposals reported separately.
            </p>
          )}
        </>
      )}
    </div>
  );
}
function PottsHistory({
  segments,
  observable,
}: {
  segments: PottsSegment[];
  observable: string;
}) {
  const values = segments.flatMap((s) =>
      s.history.map((h) => h.values[observable] ?? 0),
    ),
    min = Math.min(0, ...values),
    max = Math.max(1, ...values);
  return (
    <>
      {segments.map((s) => {
        const first = s.history[0]?.update ?? s.startUpdate,
          last = s.history.at(-1)?.update ?? first;
        return (
          <div key={s.id}>
            <p style={{ color: segmentColor(s.id) }}>
              Segment {s.id}: {s.history.length} recent / {s.samples} full
              measurements; updates {first}–{last}.
            </p>
            <svg
              viewBox="0 0 440 200"
              role="img"
              aria-label={`Potts segment ${s.id} ${observable} history`}
            >
              <text x="20" y="18" fontSize="12">
                {observable}: {fmt(min)} … {fmt(max)}
              </text>
              <line x1="30" x2="420" y1="160" y2="160" stroke="#777" />
              {s.history.map((h) => (
                <circle
                  key={h.update}
                  cx={
                    30 + (390 * (h.update - first)) / Math.max(1, last - first)
                  }
                  cy={
                    160 -
                    (125 * ((h.values[observable] ?? 0) - min)) / (max - min)
                  }
                  r="2"
                  fill={segmentColor(s.id)}
                />
              ))}
              <text x="30" y="180" fontSize="12">
                {first}
              </text>
              <text x="370" y="180" fontSize="12">
                {last}
              </text>
            </svg>
          </div>
        );
      })}
      <p className="plot-note">
        Latest 256 measured records per segment; evicted data are not
        reconstructed or joined. Coordinates count algorithmic updates, not
        physical time. Direct draws are independent; local measurements are
        Markov-correlated.
      </p>
    </>
  );
}
