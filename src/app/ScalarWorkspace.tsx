import { useEffect, useRef, useState } from 'react';
import { drawingPositions, graphPreset, presetNames } from '../domain/graph';
import type { GraphPreset } from '../domain/graph';
import {
  scalarAction,
  conditionalPotential,
  localPotential,
  quarticReference,
  scalarPreset,
} from '../models/scalarField';
import type { ScalarModel, ScalarPreset } from '../models/scalarField';
import type { ScalarTrace } from '../engine/scalarRun';
import { formatNumber } from '../plotting/PlotFrame';
import { InlineMath } from '../ui/Math';
const examples: Record<ScalarPreset, string> = {
  baseline: 'Gaussian baseline',
  pair: 'Coupled Gaussian pair',
  'double-well': 'Symmetric double well',
  'tilted-well': 'Tilted double well',
  'four-gaussian': 'Four coupled Gaussians',
  'four-quartic': 'Four coupled quartic sites',
};
export function ScalarWorkspace({
  model,
  state,
  trace,
  selected,
  setSelected,
  apply,
  disabled,
}: {
  model: ScalarModel;
  state: number[] | null;
  trace?: ScalarTrace;
  selected: string;
  setSelected: (v: string) => void;
  apply: (m: ScalarModel) => void;
  disabled: boolean;
}) {
  const { domain } = model.parameters,
    positions = drawingPositions(domain);
  const [edge, setEdge] = useState(domain.edges[0]?.id ?? '');
  const [draft, setDraft] = useState(
    () =>
      Object.fromEntries(
        (['a', 'lambda', 'h', 'kappa'] as const).map((key) => [
          key,
          Object.fromEntries(
            Object.entries(model.parameters[key]).map(([id, v]) => [
              id,
              String(v),
            ]),
          ),
        ]),
      ) as Record<'a' | 'lambda' | 'h' | 'kappa', Record<string, string>>,
  );
  const editor = useRef<HTMLDetailsElement>(null),
    input = useRef<Record<string, HTMLInputElement | null>>({});
  const key = JSON.stringify(model.parameters);
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        (['a', 'lambda', 'h', 'kappa'] as const).map((key) => [
          key,
          Object.fromEntries(
            Object.entries(model.parameters[key]).map(([id, v]) => [
              id,
              String(v),
            ]),
          ),
        ]),
      ) as typeof draft,
    );
  }, [key]);
  const i = domain.vertices.findIndex((v) => v.id === selected),
    bond = domain.edges.find((e) => e.id === edge);
  const neighbor =
    state &&
    domain.edges
      .filter(
        (e) =>
          e.tail !== e.head && (e.tail === selected || e.head === selected),
      )
      .map((e) => {
        const other = e.tail === selected ? e.head : e.tail,
          j = domain.vertices.findIndex((v) => v.id === other);
        return {
          edge: e.id,
          other,
          value: state[j]!,
          k: model.parameters.kappa[e.id]!,
        };
      });
  const cond =
    state &&
    (() => {
      let A = model.parameters.a[selected]!,
        H = model.parameters.h[selected]!;
      for (const item of neighbor!) {
        A += item.k;
        H += item.k * item.value;
      }
      return quarticReference(A, model.parameters.lambda[selected]!, H);
    })();
  const color = (v: number) =>
    `hsl(${v >= 0 ? 172 : 25} 51% ${Math.round(90 - 45 * Math.tanh(Math.abs(v) / 3))}%)`;
  const set = (group: keyof typeof draft, id: string, value: string) =>
    setDraft({ ...draft, [group]: { ...draft[group], [id]: value } });
  return (
    <section
      className="graph-workspace scalar-workspace"
      aria-label="Interactive real scalar graph"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            Real field configuration · separate from plots
          </p>
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
        aria-label="Real field values and oriented gradient bonds"
      >
        {domain.edges.map((e) => {
          const [x1, y1] = positions[e.tail]!,
            [x2, y2] = positions[e.head]!,
            group = domain.edges.filter(
              (q) =>
                (q.tail === e.tail && q.head === e.head) ||
                (q.tail === e.head && q.head === e.tail),
            ),
            rank = group.findIndex((q) => q.id === e.id),
            shift = (rank - (group.length - 1) / 2) * 30,
            dx = x2 - x1,
            dy = y2 - y1,
            len = Math.hypot(dx, dy) || 1,
            cx = (x1 + x2) / 2 - (dy / len) * shift,
            cy = (y1 + y2) / 2 + (dx / len) * shift;
          const path =
            e.tail === e.head
              ? `M${x1 - 15},${y1 - 12} C${x1 - 65},${y1 - 80} ${x1 + 65},${y1 - 80} ${x1 + 15},${y1 - 12}`
              : `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
          return (
            <g
              key={e.id}
              role="button"
              tabIndex={0}
              aria-label={`Select bond ${e.id}, ${e.tail} to ${e.head}`}
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
                className={`graph-edge ${edge === e.id || e.tail === selected || e.head === selected ? 'selected-interaction' : ''} ${trace?.edges.some((c) => c.edgeId === e.id) ? 'updated-interaction' : ''}`}
                stroke="#14625a"
                strokeWidth={1 + Math.min(4, model.parameters.kappa[e.id]!)}
                strokeDasharray={e.wraps ? '5 4' : undefined}
                fill="none"
              />
              <text
                x={cx}
                y={cy - 7}
                textAnchor="middle"
                className="edge-label"
              >
                {e.id}: κ={formatNumber(model.parameters.kappa[e.id]!)}
              </text>
            </g>
          );
        })}
        {domain.vertices.map((v, j) => {
          const [x, y] = positions[v.id]!,
            value = state?.[j];
          return (
            <g
              key={v.id}
              role="button"
              tabIndex={0}
              aria-label={`Select variable ${v.id}, value ${value === undefined ? 'not sampled' : formatNumber(value)}`}
              onClick={() => setSelected(v.id)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  setSelected(v.id);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r="28"
                fill={value === undefined ? '#e8eee9' : color(value)}
                stroke={selected === v.id ? '#183e37' : '#7c8b80'}
                strokeWidth={selected === v.id ? 3 : 1}
              />
              {trace?.site === v.id && (
                <circle cx={x} cy={y} r="33" className="updated-site" />
              )}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                className="scalar-value"
              >
                {formatNumber(value ?? null)}
              </text>
              <text x={x} y={y + 45} textAnchor="middle">
                {v.id}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="plot-note">
        Numbers are the current real values. Fixed color scale uses tanh(|x|/3):
        teal positive, ochre negative; values are never hidden. Dark outlines
        mark selection; gold rings mark the latest update. Dashed bonds wrap.
        Each parallel bond keeps its ID.
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
            {domain.edges.length ? (
              domain.edges.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id}: {e.tail} → {e.head}
                  {e.wraps ? ' (wrap)' : ''}
                </option>
              ))
            ) : (
              <option value="">No bonds</option>
            )}
          </select>
        </label>
      </div>
      <div className="selection-panels">
        <details className="selection-panel" data-testid="scalar-site-panel">
          <summary>
            Site {selected} · x = {formatNumber(state?.[i] ?? null)} · local
            potentials
          </summary>
          <p>
            <InlineMath>{String.raw`V_i(z)=a_iz^2/2+\lambda_iz^4/4-h_iz`}</InlineMath>
            ; a={formatNumber(model.parameters.a[selected]!)} λ=
            {formatNumber(model.parameters.lambda[selected]!)} h=
            {formatNumber(model.parameters.h[selected]!)}
          </p>
          {state && (
            <>
              <p>
                Bare Vᵢ(current) ={' '}
                {formatNumber(localPotential(model, i, state[i]!))}; conditional
                Vᵢᶜᵒⁿᵈ(current) ={' '}
                {formatNumber(conditionalPotential(model, state, i, state[i]!))}
                .
              </p>
              <ul>
                {neighbor!.map((c) => (
                  <li key={c.edge}>
                    {c.edge}: neighbor {c.other} = {formatNumber(c.value)}, κ ={' '}
                    {formatNumber(c.k)}
                  </li>
                ))}
              </ul>
              {model.parameters.domain.edges
                .filter((e) => e.tail === selected && e.head === selected)
                .map((e) => (
                  <p key={e.id}>
                    Self-link {e.id}: zero gradient contribution.
                  </p>
                ))}
              {cond && (
                <p>
                  Normalized conditional density given these neighbors:{' '}
                  {cond.kind}. Mean {formatNumber(cond.mean)}, variance{' '}
                  {formatNumber(cond.variance)}. This is not the equilibrium
                  marginal.{' '}
                  {cond.kind === 'Numerical quadrature reference' &&
                    `Quadrature domain [${cond.domain.map(formatNumber).join(', ')}], normalized tail bound ≤ ${cond.tailBound.toExponential(2)}; adaptive integration targets about 1e−8 relative precision and reports failure if it cannot converge.`}
                </p>
              )}
            </>
          )}
          <p className="plot-note">
            Bare potential, fixed-neighbor conditional potential, normalized
            conditional density and sampled marginal are separate views.
          </p>
        </details>
        {bond && (
          <details className="selection-panel" data-testid="scalar-bond-panel">
            <summary>
              Bond {bond.id} · {bond.tail} → {bond.head} · κ ={' '}
              {formatNumber(model.parameters.kappa[bond.id]!)}
            </summary>
            <p>
              {bond.tail === bond.head
                ? 'Self-link'
                : bond.wraps
                  ? 'Periodic/wrapped'
                  : 'Ordinary'}{' '}
              · difference xₜ−xₕ ={' '}
              {state
                ? formatNumber(
                    state[
                      domain.vertices.findIndex((v) => v.id === bond.tail)
                    ]! -
                      state[
                        domain.vertices.findIndex((v) => v.id === bond.head)
                      ]!,
                  )
                : '—'}
              .
            </p>
            <p>
              <InlineMath>{String.raw`S_e=\kappa_e(x_t-x_h)^2/2`}</InlineMath> ={' '}
              {state
                ? formatNumber(
                    (model.parameters.kappa[bond.id]! *
                      (state[
                        domain.vertices.findIndex((v) => v.id === bond.tail)
                      ]! -
                        state[
                          domain.vertices.findIndex((v) => v.id === bond.head)
                        ]!) **
                        2) /
                      2,
                  )
                : '—'}
            </p>
            <button
              className="button"
              onClick={() => {
                if (editor.current) editor.current.open = true;
                input.current[bond.id]?.focus();
              }}
            >
              Edit coupling {bond.id}
            </button>
            <p className="plot-note">
              The shared form applies all validated parameters and starts a new
              segment.
            </p>
          </details>
        )}
      </div>
      <details className="graph-editor" ref={editor}>
        <summary>Geometry & scalar parameters</summary>
        <label>
          Experiment preset
          <select
            aria-label="Scalar preset"
            value=""
            disabled={disabled}
            onChange={(e) =>
              apply(scalarPreset(e.target.value as ScalarPreset))
            }
          >
            <option value="">Choose a preset…</option>
            {Object.entries(examples).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Geometry preset
          <select
            aria-label="Scalar geometry"
            value={domain.id === 'pair' ? 'pair' : domain.id}
            disabled={disabled}
            onChange={(e) => {
              const kind = e.target.value as GraphPreset | 'pair';
              const next =
                kind === 'site'
                  ? scalarPreset('baseline')
                  : kind === 'pair'
                    ? scalarPreset('pair')
                    : (() => {
                        const domain = graphPreset(kind);
                        return {
                          kind: 'scalar' as const,
                          parameters: {
                            domain,
                            a: Object.fromEntries(
                              domain.vertices.map((v) => [v.id, 1]),
                            ),
                            lambda: Object.fromEntries(
                              domain.vertices.map((v) => [v.id, 0]),
                            ),
                            h: Object.fromEntries(
                              domain.vertices.map((v) => [v.id, 0]),
                            ),
                            kappa: Object.fromEntries(
                              domain.edges.map((e) => [e.id, 0.7]),
                            ),
                          },
                        };
                      })();
              apply(next);
            }}
          >
            <option value="pair">Coupled pair</option>
            {Object.entries(presetNames).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="plot-note">
          Changing topology starts a new session. Numerical edits keep
          compatible vector state and RNG, start new measurements and restart
          warm-up.
        </p>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const read = (key: keyof typeof draft) =>
              Object.fromEntries(
                Object.entries(draft[key]).map(([id, v]) => [
                  id,
                  v.trim() ? Number(v) : NaN,
                ]),
              );
            apply({
              ...model,
              parameters: {
                ...model.parameters,
                a: read('a'),
                lambda: read('lambda'),
                h: read('h'),
                kappa: read('kappa'),
              },
            });
          }}
        >
          <div className="graph-fields">
            {domain.vertices.flatMap((v) =>
              (
                [
                  ['a', 'Quadratic a'],
                  ['lambda', 'Quartic λ'],
                  ['h', 'Source h'],
                ] as const
              ).map(([key, label]) => (
                <label key={`${key}:${v.id}`}>
                  {label} at {v.id}
                  <input
                    aria-label={`${label} ${v.id}`}
                    type="number"
                    step="any"
                    value={draft[key][v.id] ?? ''}
                    onChange={(e) => set(key, v.id, e.target.value)}
                  />
                </label>
              )),
            )}
          </div>
          <div className="graph-fields">
            {domain.edges.map((e) => (
              <label key={e.id}>
                κ {e.id} · {e.tail} → {e.head}
                <input
                  ref={(node) => {
                    input.current[e.id] = node;
                  }}
                  aria-label={`Coupling ${e.id}`}
                  type="number"
                  step="any"
                  min="0"
                  max="10"
                  value={draft.kappa[e.id] ?? ''}
                  onChange={(ev) => set('kappa', e.id, ev.target.value)}
                />
              </label>
            ))}
          </div>
          <button className="button primary" disabled={disabled}>
            Apply scalar parameters
          </button>
          <p className="plot-note">
            λ=0 requires a≥0.05; λ&gt;0 permits negative a. κ≥0. Bounds are
            sufficient for normalizability. Apply preserves compatible
            configuration and RNG.
          </p>
        </form>
      </details>
      {state && (
        <p className="plot-note" data-testid="scalar-configuration">
          Configuration: [{state.map((v) => formatNumber(v)).join(', ')}];
          action S={formatNumber(scalarAction(model, state))}.
        </p>
      )}
    </section>
  );
}
