import type { XYModel } from '../models/xy';
import { rotateXY, xyConditional, xyObservables } from '../models/xy';
import { xyVortices } from '../models/xyVortices';
import { cachedXYReference, xyConditionalDensity } from '../models/xyReference';
import type { XYSnapshot } from '../engine/xyRun';
import { formatNumber as fmt } from '../plotting/PlotFrame';
import { segmentColor } from '../plotting/viewport';
import { DisplayMath } from '../ui/Math';
import { XYConfigurationView, XYSelectors } from './XYConfiguration';
import type { XYSelection } from './XYConfiguration';
import type { ToolDefinition } from './ToolDeck';
export const xyTools = [
  {
    id: 'configuration',
    title: 'XY spin configuration',
    kind: 'Visualization',
    description:
      'Actual planar site spins, physical bonds and optional vortex overlay.',
  },
  {
    id: 'conditional',
    title: 'Conditional von Mises density',
    kind: 'Analysis',
    description:
      'Selected site with all neighbors fixed, not an equilibrium marginal.',
  },
  {
    id: 'reference',
    title: 'XY finite-volume reference',
    kind: 'Analysis',
    description:
      'Analytical Bessel, controlled character sum or tiny quadrature.',
  },
  {
    id: 'measurements',
    title: 'Spin-vector and action measurements',
    kind: 'Analysis',
    description: 'Separate component means and mean instantaneous magnitude.',
  },
  {
    id: 'correlation',
    title: 'XY pair and spatial correlations',
    kind: 'Plot',
    description: 'Raw spin dot products, with separate x/y origins.',
  },
  {
    id: 'history',
    title: 'XY measurement history',
    kind: 'Plot',
    description:
      'Bounded retained measurements; updates are not physical time.',
  },
  {
    id: 'transition',
    title: 'Latest XY update',
    kind: 'Analysis',
    description: 'Real proposal/resample, action difference and uniform work.',
  },
  {
    id: 'rotation',
    title: 'Global spin rotation',
    kind: 'Visualization',
    description: 'A single common angle, allowed as a symmetry only at h=0.',
  },
  {
    id: 'vortices',
    title: 'Oriented plaquette vortices',
    kind: 'Analysis',
    description:
      'Principal real increments, integer checks and ambiguity coverage.',
  },
] as const satisfies readonly ToolDefinition<string>[];
export type XYToolId = (typeof xyTools)[number]['id'];
export type XYOptions = {
  overlay: boolean;
  alpha: string;
  preview: boolean;
  history: string;
  axis: 0 | 1;
  compare: number;
};
export const defaultXYOptions: XYOptions = {
  overlay: true,
  alpha: '0.7',
  preview: false,
  history: 'mAbs',
  axis: 0,
  compare: 0,
};
/** Small common SVG projector: scientific series are supplied by each tool.
 * No interpolation crosses a segment/omission. Coordinates have explicit units. */
function XYChart({
  series,
  xLabel,
  yLabel,
  xRange,
  yRange,
}: {
  series: { label: string; color: string; points: [number, number][] }[];
  xLabel: string;
  yLabel: string;
  xRange?: [number, number];
  yRange?: [number, number];
}) {
  const points = series.flatMap((s) => s.points),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const xmin = xRange?.[0] ?? Math.min(0, ...xs),
    xmax = xRange?.[1] ?? Math.max(1, ...xs),
    ymin = yRange?.[0] ?? Math.min(0, ...ys),
    ymax = yRange?.[1] ?? Math.max(1, ...ys);
  const x = (v: number) => 48 + (335 * (v - xmin)) / (xmax - xmin || 1),
    y = (v: number) => 195 - (163 * (v - ymin)) / (ymax - ymin || 1);
  return (
    <>
      <svg
        className="xy-chart"
        viewBox="0 0 410 245"
        role="img"
        aria-label={`${yLabel} versus ${xLabel}`}
      >
        <path d="M48 25V195H383" fill="none" stroke="#879997" />
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              points={s.points.map(([a, b]) => `${x(a)},${y(b)}`).join(' ')}
            />
            {s.points.length <= 12 &&
              s.points.map(([a, b], i) => (
                <circle key={i} cx={x(a)} cy={y(b)} r="3" fill={s.color} />
              ))}
          </g>
        ))}
        <text x="48" y="214" fontSize="11">
          {fmt(xmin)}
        </text>
        <text x="383" y="214" textAnchor="end" fontSize="11">
          {fmt(xmax)}
        </text>
        <text x="42" y="38" textAnchor="end" fontSize="11">
          {fmt(ymax)}
        </text>
        <text x="42" y="195" textAnchor="end" fontSize="11">
          {fmt(ymin)}
        </text>
        <text x="210" y="238" textAnchor="middle" fontSize="12">
          {xLabel}
        </text>
        <text x="48" y="17" fontSize="12">
          {yLabel}
        </text>
      </svg>
      <p className="plot-note">
        {series.map((s) => (
          <span key={s.label} style={{ color: s.color }}>
            {s.label} ·{' '}
          </span>
        ))}
      </p>
    </>
  );
}
export function XYTool({
  id,
  model,
  snapshot,
  selection,
  select,
  options,
  changeOptions,
  ready,
  rotate,
}: {
  id: XYToolId;
  model: XYModel;
  snapshot: XYSnapshot | null;
  selection: XYSelection;
  select: (s: XYSelection) => void;
  options: XYOptions;
  changeOptions: (o: XYOptions) => void;
  ready: boolean;
  rotate: (alpha: number) => void;
}) {
  const state = snapshot?.angles ?? new Float64Array(model.size),
    current = snapshot?.segments.at(-1),
    segments = snapshot?.segments ?? [];
  if (id === 'configuration')
    return (
      <XYConfigurationView
        {...{ model, selection, select }}
        angles={state}
        charges={snapshot?.vortices.faces ?? []}
        overlay={options.overlay}
        setOverlay={(overlay) => changeOptions({ ...options, overlay })}
      />
    );
  if (id === 'conditional') {
    const c = xyConditional(model, state, selection.site),
      points: [number, number][] = Array.from({ length: 129 }, (_, i) => {
        const a = -Math.PI + (2 * Math.PI * i) / 128;
        return [a, xyConditionalDensity(a, c.R, c.mu)];
      });
    return (
      <>
        <XYSelectors {...{ model, selection, select }} />
        <p data-testid="xy-conditional">
          Fixed-neighbor conditional at site {selection.site}: H=({fmt(c.hx)},{' '}
          {fmt(c.hy)}), R={fmt(c.R)}, μ=
          {c.mu === null ? 'undefined (uniform)' : `${fmt(c.mu)} rad`}; current
          θ={fmt(state[selection.site]!)}.
        </p>
        <DisplayMath>{String.raw`\rho_i(\theta\mid\theta_{-i})=\frac{e^{R\cos(\theta-\mu)}}{2\pi I_0(R)}`}</DisplayMath>
        <XYChart
          series={[{ label: 'Conditional density', color: '#166c67', points }]}
          xLabel="θ (radians)"
          yLabel="Density per radian"
          xRange={[-Math.PI, Math.PI]}
        />
        <p className="plot-note">
          Neighbors are held fixed. This curve is not the equilibrium site
          marginal.
        </p>
        <ul>
          {c.contributions.map((b) => (
            <li key={b.bond}>
              {b.bond}: neighbor {b.neighbor}, K={b.K}, θ={fmt(b.angle)}; vector
              ({fmt(b.x)}, {fmt(b.y)}).
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (id === 'reference') {
    const ref = cachedXYReference(model),
      v = ref.values;
    return (
      <>
        <p data-testid="xy-reference">
          {ref.status}: {ref.reason}
        </p>
        {v && (
          <>
            <p>
              Normalized Haar ∏dθ/(2π): Z=
              {Number.isFinite(v.Z) ? fmt(v.Z) : 'too large; use log Z'}, log Z=
              {fmt(v.logZ)}.
            </p>
            <p>
              Reference ⟨mₓ⟩={fmt(v.mx)}, ⟨mᵧ⟩={fmt(v.my)}, ⟨S⟩={fmt(v.action)}.
              Numerical allowance {ref.error?.toExponential(2)}; resolution{' '}
              {ref.resolution}.
            </p>
            <table aria-label="XY reference comparison">
              <thead>
                <tr>
                  <th>Observable</th>
                  <th>Reference</th>
                  <th>Current segment mean</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['mₓ', v.mx, current?.moments.mx],
                  ['mᵧ', v.my, current?.moments.my],
                  ['S', v.action, current?.moments.action],
                ].map(([label, value, moment]) => (
                  <tr key={String(label)}>
                    <th>{String(label)}</th>
                    <td>{fmt(value as number)}</td>
                    <td>
                      {typeof moment === 'object' && moment?.count
                        ? fmt(moment.mean)
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
                {model.bonds.map((b, i) => (
                  <tr key={b.id}>
                    <th>cos Δθ {b.id}</th>
                    <td>{fmt(v.bonds[i]!)}</td>
                    <td>
                      {current?.bonds[i]?.count
                        ? fmt(current.bonds[i]!.mean)
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="plot-note">
          Numerical character sums and quadrature are finite-volume references
          with resolution gates. Neither their agreement with a short run nor a
          warm-up budget certifies mixing.
        </p>
        {model.graph?.id === 'triangle' &&
          model.h === 0 &&
          model.bonds.every((b) => b.K < 0 && b.K === model.bonds[0]!.K) && (
            <p data-testid="xy-frustration">
              Equal antiferromagnetic triangle: two 120° chiral orientations
              modulo global rotation; each bond cosine −1/2, minimum S=
              {fmt(1.5 * model.bonds[0]!.K)}. A triangle has no declared square
              plaquette; chirality is not this lattice-vortex charge.
            </p>
          )}
      </>
    );
  }
  if (id === 'measurements')
    return (
      <>
        <p>
          Current: mₓ={fmt(xyObservables(model, state).mx!)}, mᵧ=
          {fmt(xyObservables(model, state).my!)}, |m|=
          {fmt(xyObservables(model, state).mAbs!)}.
        </p>
        <table aria-label="XY segment measurements">
          <thead>
            <tr>
              <th>Segment / N</th>
              <th>⟨mₓ⟩</th>
              <th>⟨mᵧ⟩</th>
              <th>⟨|m|⟩</th>
              <th>⟨S/V⟩</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id} style={{ color: segmentColor(s.id) }}>
                <th>
                  {s.id} / {s.samples}
                </th>
                {['mx', 'my', 'mAbs', 'actionDensity'].map((key) => (
                  <td key={key}>
                    {s.samples ? fmt(s.moments[key]!.mean) : 'N/A'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          ⟨|m|⟩ differs from |⟨m⟩|. At h=0 exact finite-volume component means
          vanish, but a finite chain may explore the common angle slowly. S/V is
          dimensionless action density. No independent-sample error bars.
        </p>
        {current?.sites[selection.site] && (
          <p>
            Selected site {selection.site}: ⟨cos θ⟩=
            {current.samples
              ? fmt(current.sites[selection.site]!.cosine.mean)
              : 'N/A'}
            ; ⟨sin θ⟩=
            {current.samples
              ? fmt(current.sites[selection.site]!.sine.mean)
              : 'N/A'}
            ; angular histogram covers all {current.samples} retained states.
          </p>
        )}
      </>
    );
  if (id === 'history') {
    const keys = Object.keys(current?.moments ?? xyObservables(model, state));
    if (model.faces.length)
      keys.push(
        'vortex-density',
        'vortex-positive',
        'vortex-negative',
        'vortex-net',
      );
    const key = keys.includes(options.history) ? options.history : 'mAbs';
    // Split at omitted vortex records. Lines never bridge coverage gaps.
    const series: {
      label: string;
      color: string;
      points: [number, number][];
    }[] = [];
    for (const s of segments) {
      let points: [number, number][] = [];
      let part = 0;
      const push = () => {
        if (points.length)
          series.push({
            label: `Segment ${s.id}${part++ ? ' continued' : ''}`,
            color: segmentColor(s.id),
            points,
          });
        points = [];
      };
      for (const h of s.history) {
        if (h.values[key] === undefined) push();
        else points.push([h.update, h.values[key]!]);
      }
      push();
    }
    return (
      <>
        <label>
          XY history observable
          <select
            value={key}
            onChange={(e) =>
              changeOptions({ ...options, history: e.target.value })
            }
          >
            {keys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <XYChart
          series={series}
          xLabel="Global site-update number (not time)"
          yLabel={key}
          xRange={
            series.length
              ? [
                  Math.min(...series.flatMap((s) => s.points.map((p) => p[0]))),
                  Math.max(...series.flatMap((s) => s.points.map((p) => p[0]))),
                ]
              : undefined
          }
        />
        <p>
          Latest 256 scheduled measurements per segment; lines only interpolate
          retained observations. Full-segment moments survive eviction.
          Parameter segments stay separate; omitted vortex records break the
          curve.
        </p>
      </>
    );
  }
  if (id === 'correlation') {
    if (model.shape) {
      const data = options.axis === 0 ? current?.spatialX : current?.spatialY;
      return (
        <>
          <label>
            XY correlation direction
            <select
              value={options.axis}
              onChange={(e) =>
                changeOptions({
                  ...options,
                  axis: Number(e.target.value) as 0 | 1,
                })
              }
            >
              <option value="0">x</option>
              <option value="1">y</option>
            </select>
          </label>
          <XYChart
            series={[
              {
                label: `Segment ${current?.id ?? 1}, raw ${options.axis === 0 ? 'x' : 'y'}`,
                color: '#166c67',
                points:
                  data
                    ?.filter((d) => d.moments.count)
                    .map((d) => [d.r, d.moments.mean]) ?? [],
              },
            ]}
            xLabel="Displacement r (sites)"
            yLabel="Raw ⟨cos(θᵢ₊ᵣ−θᵢ)⟩"
            yRange={[-1, 1]}
          />
          <p>
            Separate directions; wrap only periodic axes and average admissible
            origins for open axes. C(0)=1. Raw spin dot products, not spatially
            demeaned or connected covariance.
          </p>
        </>
      );
    }
    const compare = Math.min(options.compare, model.size - 1),
      value = current?.pairs?.[selection.site]?.[compare];
    return (
      <>
        <XYSelectors {...{ model, selection, select }} />
        <label>
          XY comparison site
          <input
            type="number"
            min="0"
            max={model.size - 1}
            value={compare}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n < model.size)
                changeOptions({ ...options, compare: n });
            }}
          />
        </label>
        <p>
          Current cos(θ{compare}−θ{selection.site})=
          {fmt(Math.cos(state[compare]! - state[selection.site]!))};
          full-segment raw pair mean={value?.count ? fmt(value.mean) : 'N/A'}.
        </p>
      </>
    );
  }
  if (id === 'transition') {
    const t = snapshot?.trace;
    return (
      <>
        <p data-testid="xy-transition">
          {t
            ? `Site ${t.site}: ${t.sampler}, ${t.outcome}; before ${fmt(t.before)}, proposed ${fmt(t.proposed)}, after ${fmt(t.after)} rad. Proposed ΔS=${fmt(t.proposedDelta)}; actual ΔS=${fmt(t.actualDelta)}; ${t.draws} uniforms; ${t.trials} internal conditional trials.`
            : snapshot?.event
              ? `Deterministic global-rotation event α=${fmt(snapshot.event.alpha)}; no update, draw or measurement.`
              : 'Step to inspect an actual XY transition.'}
        </p>
        {t?.sampler === 'metropolis' && (
          <p>
            Acceptance probability={fmt(t.probability)}, decision uniform=
            {fmt(t.decision)}. Rejection holds the entire configuration.
          </p>
        )}
        {current?.settings.sampler === 'metropolis' ? (
          <>
            <svg
              className="xy-acceptance"
              viewBox="0 0 300 30"
              role="img"
              aria-label="XY accepted and rejected proposals"
            >
              <rect
                width={(300 * current.accepted) / (current.updates || 1)}
                height="24"
                fill="#166c67"
              />
              <rect
                x={(300 * current.accepted) / (current.updates || 1)}
                width={(300 * current.rejected) / (current.updates || 1)}
                height="24"
                fill="#b95b3e"
              />
            </svg>
            <p>
              Including warm-up: accepted {current.accepted}, rejected{' '}
              {current.rejected}; acceptance{' '}
              {current.updates
                ? fmt((100 * current.accepted) / current.updates) + '%'
                : 'N/A'}
              .
            </p>
          </>
        ) : (
          <p>
            Acceptance rate: N/A. Heat bath completes a conditional resampling;
            internal rejected candidates are not rejected XY chain updates.
          </p>
        )}
        <p>
          Including warm-up: {current?.draws ?? 0} uniforms,{' '}
          {current?.trials ?? 0} conditional candidate trials in this segment.
          Session uniforms {snapshot?.draws ?? 0} include random initialization.
        </p>
      </>
    );
  }
  if (id === 'rotation') {
    const alpha = Number(options.alpha),
      valid =
        options.alpha.trim() !== '' &&
        Number.isFinite(alpha) &&
        Math.abs(alpha) <= 1e6,
      preview = options.preview && valid && model.h === 0;
    const angles = preview ? rotateXY(state, alpha) : state,
      vortices = preview ? xyVortices(model, angles) : snapshot?.vortices;
    return (
      <>
        <p>
          One common spin rotation θᵢ→θᵢ+α. This is global O(2) symmetry at h=0,
          not a local gauge transformation. Magnetization components rotate;
          magnitude, bond cosines and unambiguous vortices remain.
        </p>
        <label>
          Global XY rotation α
          <input
            type="number"
            step="any"
            value={options.alpha}
            onChange={(e) =>
              changeOptions({ ...options, alpha: e.target.value })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.preview}
            disabled={model.h !== 0}
            onChange={(e) =>
              changeOptions({ ...options, preview: e.target.checked })
            }
          />
          Preview XY rotation
        </label>
        <button
          disabled={!ready || !valid || model.h !== 0}
          onClick={() => {
            rotate(alpha);
            changeOptions({ ...options, preview: false });
          }}
        >
          Apply global XY rotation
        </button>
        {model.h !== 0 && (
          <p role="note">
            h≠0 breaks global spin rotation; applying it as a symmetry is
            unavailable.
          </p>
        )}
        <XYConfigurationView
          {...{ model, selection, select }}
          angles={angles}
          charges={vortices?.faces ?? []}
          overlay={options.overlay}
          setOverlay={(overlay) => changeOptions({ ...options, overlay })}
          preview={preview}
        />
        <p>
          Apply requires Pause acknowledgment. It changes no RNG, update,
          measurement or segment; accumulated statistics stay as measured.
        </p>
      </>
    );
  }
  const v = snapshot?.vortices,
    f = v?.faces[selection.face];
  if (!model.faces.length)
    return (
      <p>
        No declared oriented plaquette on this graph. A cycle or frustrated
        triangle alone does not define square-lattice vorticity.
      </p>
    );
  return (
    <>
      <XYSelectors {...{ model, selection, select }} />
      <p data-testid="xy-vortices">
        {v
          ? `Current valid faces ${v.validFaces}/${v.faces.length}; positive ${v.positive}, negative ${v.negative}; valid-face charge sum ${v.net}; absolute ${v.absolute}; density ${v.density === null ? 'N/A (incomplete coverage)' : fmt(v.density)} per elementary face; ambiguous ${v.ambiguous}, noninteger ${v.noninteger}.`
          : 'Waiting for the worker.'}
      </p>
      {f && (
        <>
          <p>
            Selected {f.id}: {f.status}; winding={fmt(f.winding)}, charge=
            {f.charge === null ? 'not certified' : f.charge}.
          </p>
          <p>
            {model.faces[selection.face]!.boundary.map(
              ({ bond, sign }, i) =>
                `${sign > 0 ? '+' : '−'}${model.bonds[bond]!.id}: ${fmt(f.increments[i]!)} rad`,
            ).join('; ')}
          </p>
        </>
      )}
      <DisplayMath>{String.raw`Q_f=\frac{1}{2\pi}\sum_{e\in\partial f}\epsilon_{fe}\,\operatorname{wrap}(\theta_h-\theta_t)`}</DisplayMath>
      <p>
        Reverse traversal negates the stored forward increment. Near-antipodal
        bonds (within 10⁻¹⁰ rad) are branch-sensitive; integer residual
        tolerance is 10⁻¹⁰. The complex product around an XY face is still one
        even for Q≠0. These are spin vortices, not U(1) gauge curvature.
      </p>
      <p>
        {(model.shape?.periodicX && model.shape.periodicY) ||
        model.graph?.id === 'torus'
          ? 'Fully periodic: the signed face incidences imply zero total charge when all faces are valid.'
          : 'Open or mixed boundaries: boundary winding permits a nonzero total charge.'}
      </p>
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Valid configurations / retained</th>
            <th>Mean density</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.id}>
              <th>{s.id}</th>
              <td>
                {s.vortex?.coverage ?? 0} / {s.samples}
              </td>
              <td>
                {s.vortex?.coverage
                  ? fmt(s.vortex.moments.density.mean)
                  : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
