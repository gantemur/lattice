import { useEffect, useState } from 'react';
import type { IsingModel } from '../models/ising';
import {
  exactIsing,
  isingPreset,
  isingTargets,
  isingReference,
  neighborhood,
  flipDifference,
  conditionalPlus,
  bondInspection,
  spins,
} from '../models/ising';
import {
  drawingPositions,
  isIsingGraphPreset,
  presetNames,
  smallIsingNames,
} from '../domain/graph';
import type { SegmentSnapshot } from '../engine/protocol';
import type { TransitionRecord } from '../observables/trajectory';
import { InlineMath } from '../ui/Math';
import { formatNumber } from '../plotting/PlotFrame';
export function GraphVisualization({
  model,
  state,
  record,
  selected,
  setSelected,
  edge,
  setEdge,
}: {
  model: IsingModel;
  state: number | null;
  record?: TransitionRecord;
  selected: string;
  setSelected: (site: string) => void;
  edge: string;
  setEdge: (edge: string) => void;
}) {
  const { domain } = model.parameters;
  const positions = drawingPositions(domain);
  const values = state === null ? null : spins(model, state);
  return (
    <section className="graph-workspace" aria-label="Interactive Ising graph">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Configuration · separate from plots</p>
          <h2>{domain.name}</h2>
        </div>
        <span className="parameter-chip">
          {domain.vertices.length} sites · {domain.edges.length} bonds ·{' '}
          {domain.faces.length} faces
        </span>
      </div>
      <svg
        className="graph-diagram"
        viewBox="0 0 360 260"
        aria-label="Spin configuration and oriented bonds"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {domain.edges.map((e) => {
          const [x1, y1] = positions[e.tail]!,
            [x2, y2] = positions[e.head]!,
            self = e.tail === e.head;
          const group = domain.edges.filter(
            (q) =>
              (q.tail === e.tail && q.head === e.head) ||
              (q.tail === e.head && q.head === e.tail),
          );
          const rank = group.findIndex((q) => q.id === e.id),
            offset = (rank - (group.length - 1) / 2) * 42,
            sign = e.tail < e.head ? 1 : -1,
            dx = x2 - x1,
            dy = y2 - y1,
            length = Math.hypot(dx, dy) || 1;
          const cx = (x1 + x2) / 2 - (dy / length) * offset * sign,
            cy = (y1 + y2) / 2 + (dx / length) * offset * sign;
          const startLength = Math.hypot(cx - x1, cy - y1) || 1,
            endLength = Math.hypot(cx - x2, cy - y2) || 1;
          const labelT =
            domain.id === 'complete' && dx !== 0 && dy !== 0 ? 0.3 : 0.5;
          const labelX =
            (1 - labelT) ** 2 * x1 +
            2 * (1 - labelT) * labelT * cx +
            labelT ** 2 * x2;
          const labelY =
            (1 - labelT) ** 2 * y1 +
            2 * (1 - labelT) * labelT * cy +
            labelT ** 2 * y2;
          const path = self
            ? `M${x1 - 12},${y1 - 12} C${x1 - 65 - rank * 15},${y1 - 75} ${x1 + 65 + rank * 15},${y1 - 75} ${x1 + 12},${y1 - 12}`
            : `M${x1 + (26 * (cx - x1)) / startLength},${y1 + (26 * (cy - y1)) / startLength} Q${cx},${cy} ${x2 + (26 * (cx - x2)) / endLength},${y2 + (26 * (cy - y2)) / endLength}`;
          const highlight =
            e.id === edge || e.tail === selected || e.head === selected;
          return (
            <g
              key={e.id}
              role="button"
              tabIndex={0}
              aria-label={`Select bond ${e.id}, ${e.tail} to ${e.head}, K ${model.parameters.couplings[e.id]}${e.wraps ? ', periodic wrap' : ''}`}
              onClick={() => setEdge(e.id)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  setEdge(e.id);
                }
              }}
            >
              <path
                d={path}
                stroke="transparent"
                strokeWidth="22"
                fill="none"
              />
              <path
                d={path}
                className={`graph-edge ${highlight ? 'selected-interaction' : ''} ${record?.ising?.contributions.some((c) => c.edgeId === e.id) ? 'updated-interaction' : ''} ${model.parameters.couplings[e.id] === 0 ? 'zero-weight' : model.parameters.couplings[e.id]! < 0 ? 'negative-weight' : 'positive-weight'}`}
                style={{
                  strokeWidth:
                    1 +
                    Math.min(3, Math.abs(model.parameters.couplings[e.id]!)),
                  opacity: model.parameters.couplings[e.id] === 0 ? 0.18 : 1,
                }}
                strokeDasharray={e.wraps ? '5 4' : undefined}
                markerEnd="url(#arrow)"
                fill="none"
              />
              <text
                x={
                  self
                    ? x1
                    : labelX +
                      (dx === 0 && group.length > 1 ? (cx < x1 ? -5 : 5) : 0)
                }
                y={self ? y1 - 53 : labelY - 5}
                textAnchor={
                  dx === 0 && group.length > 1
                    ? cx < x1
                      ? 'end'
                      : 'start'
                    : 'middle'
                }
                className="edge-label"
              >
                {e.id}: {model.parameters.couplings[e.id]}
                {e.wraps ? ' ↻' : ''}
              </text>
            </g>
          );
        })}
        {domain.vertices.map((v, i) => {
          const [x, y] = positions[v.id]!,
            spin = values?.[i];
          return (
            <g
              key={v.id}
              role="button"
              tabIndex={0}
              aria-label={`Select vertex ${v.id}, spin ${spin ?? 'not sampled'}`}
              onClick={() => setSelected(v.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(v.id);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r="25"
                className={`graph-vertex ${spin === -1 ? 'minus' : ''} ${selected === v.id ? 'selected' : ''}`}
              />
              {record?.ising?.site === v.id && (
                <circle cx={x} cy={y} r="31" className="updated-site" />
              )}
              <text x={x} y={y + 5} textAnchor="middle" className="spin-sign">
                {spin === undefined ? '?' : spin > 0 ? '+1' : '−1'}
              </text>
              <text x={x} y={y + 44} textAnchor="middle">
                {v.id} · b={model.parameters.fields[v.id]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="plot-note">
        ± signs encode spins; gold ring marks the last updated site. Dashed ↻
        bonds wrap periodically. Every labeled bond contributes separately;
        arrows define stored orientation. Teal: positive K; purple: negative K;
        faded: zero K. Thickness indicates |K|. Dark outlines/halos mark your
        selection; gold underlines mark bonds used in the latest update.
        Selected: {selected}.
      </p>
      <div className="graph-form-row">
        <label>
          Selected site
          <select
            aria-label="Selected site"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {domain.vertices.map((v) => (
              <option key={v.id}>{v.id}</option>
            ))}
          </select>
        </label>
        <label>
          Selected bond
          <select
            aria-label="Selected bond"
            value={edge}
            onChange={(e) => setEdge(e.target.value)}
          >
            {!domain.edges.length && <option value="">No bonds</option>}
            {domain.edges.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id}: {e.tail} → {e.head}
                {e.wraps ? ' (wrap)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export function GraphInspection({
  model,
  state,
  selected,
  edge,
}: {
  model: IsingModel;
  state: number | null;
  selected: string;
  edge: string;
}) {
  const { domain } = model.parameters;
  const values = state === null ? null : spins(model, state);
  const selectedEdge = domain.edges.find((bond) => bond.id === edge);
  const index = domain.vertices.findIndex((vertex) => vertex.id === selected);
  const local = state === null ? null : neighborhood(model, state, index);
  const plus = state === null ? null : conditionalPlus(model, state, index);
  const bond =
    state === null || !selectedEdge ? null : bondInspection(model, state, edge);
  return (
    <section aria-label="Graph local inspection">
      <div className="selection-panels">
        <details className="selection-panel" data-testid="selected-site-panel">
          <summary>
            Site {selected} · spin {values?.[index] ?? '—'} · local mathematics
          </summary>
          {local && state !== null ? (
            <>
              <p>
                <InlineMath>{String.raw`b_i`}</InlineMath> ={' '}
                {formatNumber(local.field)};{' '}
                <InlineMath>{String.raw`H_i=b_i+\sum_{e\ni i,\ e\text{ non-self}}K_es_{j(e)}`}</InlineMath>{' '}
                = {formatNumber(local.localField)}
              </p>
              <ul>
                {local.contributions.map((c) => (
                  <li key={c.edgeId}>
                    {c.edgeId} · {c.neighbor}: spin {c.spin}, K ={' '}
                    {formatNumber(c.coupling)}, K·spin ={' '}
                    {formatNumber(c.contribution)}
                  </li>
                ))}
                {domain.edges
                  .filter((e) => e.tail === selected && e.head === selected)
                  .map((e) => (
                    <li key={e.id}>
                      {e.id} · self-link: constant action{' '}
                      {formatNumber(-model.parameters.couplings[e.id]!)}; zero
                      flip contribution.
                    </li>
                  ))}
              </ul>
              <p>
                <InlineMath>{String.raw`\Delta S_i=2s_iH_i`}</InlineMath> ={' '}
                {formatNumber(flipDifference(model, state, index))}
              </p>
              <p>
                <InlineMath>{String.raw`P(+1\mid s_{j\ne i})=(1+e^{-2H_i})^{-1}`}</InlineMath>{' '}
                = {formatNumber(plus)}; P(−1 | neighbors) ={' '}
                {formatNumber(1 - plus!)}
              </p>
              <p className="plot-note">
                Conditional on the current neighbors, not the equilibrium
                marginal. Select spin {selected} as the target of a trajectory
                tool to inspect its history.
              </p>
            </>
          ) : (
            <p className="plot-note">Step to inspect a configuration.</p>
          )}
        </details>
        {selectedEdge && (
          <details
            className="selection-panel"
            data-testid="selected-bond-panel"
          >
            <summary>
              Bond {edge} · {selectedEdge.tail} → {selectedEdge.head} · K ={' '}
              {formatNumber(model.parameters.couplings[edge]!)}
            </summary>
            {bond && (
              <>
                <p>
                  {bond.kind} · endpoint spins {bond.tailSpin}, {bond.headSpin};
                  product {bond.product}.
                </p>
                <p>
                  <InlineMath>{String.raw`S_e=-K_es_{t(e)}s_{h(e)}`}</InlineMath>{' '}
                  = {formatNumber(bond.action)}
                </p>
                {bond.kind === 'Self-link' && (
                  <p className="plot-note">
                    Constant action; zero spin-flip difference.
                  </p>
                )}
              </>
            )}
            <button
              className="button secondary"
              onClick={() => {
                const editor = document.getElementById(
                  'graph-parameter-editor',
                ) as HTMLDetailsElement | null;
                if (editor) editor.open = true;
                document.getElementById(`graph-coupling-${edge}`)?.focus();
              }}
            >
              Edit coupling {edge}
            </button>
            <p className="plot-note">
              Edit in the parameter list, then Apply to begin a new measurement
              segment.
            </p>
          </details>
        )}
      </div>
    </section>
  );
}

export function GraphParameterEditor({
  model,
  apply,
  disabled,
}: {
  model: IsingModel;
  apply: (model: IsingModel) => void;
  disabled: boolean;
}) {
  const { domain } = model.parameters;
  const [couplings, setCouplings] = useState(
      Object.fromEntries(
        Object.entries(model.parameters.couplings).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    ),
    [fields, setFields] = useState(
      Object.fromEntries(
        Object.entries(model.parameters.fields).map(([k, v]) => [k, String(v)]),
      ),
    );
  const parameterKey = JSON.stringify([
    model.parameters.couplings,
    model.parameters.fields,
  ]);
  useEffect(() => {
    setCouplings(
      Object.fromEntries(
        Object.entries(model.parameters.couplings).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    );
    setFields(
      Object.fromEntries(
        Object.entries(model.parameters.fields).map(([k, v]) => [k, String(v)]),
      ),
    );
  }, [parameterKey]);
  return (
    <details className="graph-editor" id="graph-parameter-editor">
      <summary>Geometry & numerical parameters</summary>
      <label>
        Geometry preset
        <select
          aria-label="Geometry preset"
          value={domain.id}
          disabled={disabled}
          onChange={(e) => {
            const id = e.target.value;
            if (isIsingGraphPreset(id)) apply(isingPreset(id));
          }}
        >
          {!isIsingGraphPreset(domain.id) && (
            <option value={domain.id}>{domain.name} · loaded</option>
          )}
          {Object.entries(smallIsingNames).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
          {Object.entries(presetNames).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <p className="plot-note">
        Geometry changes start a new session and restart the chosen seed.
        Numerical coupling and field edits retain this preset’s topology. In K4,
        set unwanted pairwise couplings to zero to realize any simple four-site
        interaction graph. Zero weights never delete bond records.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const number = (v: string) => (v.trim() ? Number(v) : NaN);
          apply({
            ...model,
            parameters: {
              ...model.parameters,
              couplings: Object.fromEntries(
                Object.entries(couplings).map(([k, v]) => [k, number(v)]),
              ),
              fields: Object.fromEntries(
                Object.entries(fields).map(([k, v]) => [k, number(v)]),
              ),
            },
          });
        }}
        noValidate
      >
        <div className="graph-fields">
          {domain.vertices.map((v) => (
            <label key={v.id}>
              Field b at {v.id}
              <input
                aria-label={`Field ${v.id}`}
                type="number"
                step="any"
                min="-10"
                max="10"
                value={fields[v.id] ?? ''}
                onChange={(e) =>
                  setFields({ ...fields, [v.id]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <div className="graph-fields">
          {domain.edges.map((e) => (
            <label key={e.id}>
              K {e.id} · {e.tail} → {e.head}
              <input
                id={`graph-coupling-${e.id}`}
                aria-label={`Coupling ${e.id}`}
                type="number"
                step="any"
                min="-10"
                max="10"
                value={couplings[e.id] ?? ''}
                onChange={(ev) =>
                  setCouplings({ ...couplings, [e.id]: ev.target.value })
                }
              />
            </label>
          ))}
        </div>
        <button className="button primary" disabled={disabled}>
          Apply graph parameters
        </button>
        <p className="plot-note">
          K and b: −10 to 10. Apply preserves the configuration and RNG, begins
          separate statistics and restarts configured warm-up.
        </p>
      </form>
    </details>
  );
}

export function ExactIsingPanel({ segment }: { segment: SegmentSnapshot }) {
  const model = segment.model;
  if (model.kind !== 'ising' || !segment.ising) return null;
  const exact = exactIsing(model);
  return (
    <section className="moments-panel">
      <h2>Exact finite volume · current segment</h2>
      <table className="moments-table">
        <thead>
          <tr>
            <th>Observable</th>
            <th>Exact enumeration</th>
            <th>Sampled mean</th>
          </tr>
        </thead>
        <tbody>
          {isingTargets(model).map((target) => (
            <tr key={target}>
              <th>{target === 'E' ? 'E = S' : target}</th>
              <td>
                {formatNumber(
                  isingReference({ ...model, observable: target }).mean,
                )}
              </td>
              <td>
                {formatNumber(segment.ising!.observables[target]!.moments.mean)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="plot-note">
        log Z = {formatNumber(exact.logPartition)}. M = Σsᵢ, m = M/N, E =
        dimensionless total action S. Finite-volume magnetization is not
        spontaneous magnetization in an infinite system. No MCMC uncertainty
        estimate.
      </p>
      <details>
        <summary>
          Exact configuration probabilities ({exact.probabilities.length}{' '}
          states)
        </summary>
        <table className="moments-table">
          <thead>
            <tr>
              <th>Configuration (v0 first)</th>
              <th>S</th>
              <th>Exact P</th>
              <th>Sampled P</th>
            </tr>
          </thead>
          <tbody>
            {exact.probabilities.map((p, state) => (
              <tr key={state}>
                <th>
                  {spins(model, state)
                    .map((s) => (s > 0 ? '+' : '−'))
                    .join(' ')}
                </th>
                <td>{formatNumber(exact.actions[state]!)}</td>
                <td>{formatNumber(p)}</td>
                <td>
                  {formatNumber(
                    segment.moments.count
                      ? segment.ising!.counts[state]! / segment.moments.count
                      : null,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
