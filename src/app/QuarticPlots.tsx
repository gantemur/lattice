import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import { harmonicLimitReference } from '../models/quarticTransfer';
import { formatNumber } from '../plotting/PlotFrame';
import { useQuarticTransfer } from './useQuarticTransfer';

type Curve = {
  label: string;
  color: string;
  points: [number, number][];
  dashed?: boolean;
};
export function Chart({
  title,
  curves,
  xMin,
  xMax,
  yLimit,
  xLabel,
}: {
  title: string;
  curves: Curve[];
  xMin: number;
  xMax: number;
  yLimit?: number;
  xLabel: string;
}) {
  const values = curves
    .flatMap((curve) => curve.points.map((point) => point[1]))
    .filter(Number.isFinite);
  const low = yLimit ? -yLimit : Math.min(0, ...values);
  const high = yLimit ? yLimit : Math.max(0.1, ...values);
  const sx = (x: number) =>
    46 + (510 * (x - xMin)) / Math.max(1e-9, xMax - xMin);
  const sy = (y: number) =>
    185 -
    (150 * (Math.max(low, Math.min(high, y)) - low)) /
      Math.max(1e-9, high - low);
  return (
    <section className="field-visual oscillator-chart" aria-label={title}>
      <h2>{title}</h2>
      <svg
        viewBox="0 0 600 225"
        role="img"
        aria-label={`${title}; horizontal axis ${xLabel}`}
      >
        <line x1="46" x2="556" y1="185" y2="185" stroke="#839991" />
        <line x1="46" x2="46" y1="35" y2="185" stroke="#839991" />
        <text x="2" y="38" fontSize="12">
          {formatNumber(high)}
        </text>
        <text x="2" y="185" fontSize="12">
          {formatNumber(low)}
        </text>
        <text x="46" y="214" fontSize="12">
          {formatNumber(xMin)}
        </text>
        <text x="556" y="214" fontSize="12" textAnchor="end">
          {xLabel} {formatNumber(xMax)}
        </text>
        {curves.map((curve) => (
          <polyline
            key={curve.label}
            fill="none"
            stroke={curve.color}
            strokeWidth="2.5"
            strokeDasharray={curve.dashed ? '6 5' : undefined}
            points={curve.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')}
          />
        ))}
      </svg>
      <div className="field-segment-legend">
        {curves.map((curve) => (
          <span key={curve.label} style={{ color: curve.color }}>
            ● {curve.label}
          </span>
        ))}
      </div>
    </section>
  );
}

export function TransferTool({ p }: { p: QuarticOscillatorParameters }) {
  const { result, error } = useQuarticTransfer(p);
  return (
    <section
      className="field-results"
      aria-label="Quartic transfer spectroscopy"
    >
      <h2>Finite-spacing transfer analysis</h2>
      {!result && !error && (
        <p role="status">
          Computing three independent coordinate grids in a separate worker…
        </p>
      )}
      {error && <p role="alert">Numerical analysis unavailable: {error}</p>}
      {result && (
        <>
          <p data-testid="quartic-transfer-status">
            Gap status: <strong>{result.status}</strong>.{' '}
            {result.reasons.join(' ') ||
              'Coordinate-grid and cutoff refinements agree within 3%, with checked eigenpair residuals.'}
          </p>
          <p>
            Physical potential minimum Vmin=
            {formatNumber(result.potentialMinimum)}. The shifted operator uses
            V−Vmin; absolute energies restore this origin.
          </p>
          <table className="field-covariance">
            <thead>
              <tr>
                <th>Grid</th>
                <th>Interval / spacing</th>
                <th>t₀, t₁</th>
                <th>Approx. gap</th>
                <th>Max leading residual</th>
              </tr>
            </thead>
            <tbody>
              {result.grids.map((grid) => (
                <tr key={grid.nodes}>
                  <th>{grid.nodes} nodes</th>
                  <td>
                    ±{formatNumber(grid.cutoff)} / {formatNumber(grid.spacing)}
                  </td>
                  <td>
                    {formatNumber(grid.leading[0] ?? null)},{' '}
                    {formatNumber(grid.leading[1] ?? null)}
                  </td>
                  <td>{formatNumber(grid.gap)}</td>
                  <td>
                    {formatNumber(Math.max(...grid.residuals.slice(0, 2)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Grid-gap change {formatNumber(result.gridGapChange)};
            enlarged-cutoff change {formatNumber(result.cutoffGapChange)}.
            Kinetic width √a={formatNumber(result.grids[2].kineticWidth)}.
          </p>
          {result.status === 'resolved' ? (
            <p>
              Approximate finite-a lowest excitation gap{' '}
              <strong>{formatNumber(result.gap)}</strong>; shifted-origin levels
              E₀={formatNumber(result.groundEnergy)}, E₁=
              {formatNumber(result.firstEnergy)}.{' '}
              {p.h === 0 && p.r < 0
                ? 'For this symmetric double well the low splitting is tunneling-related.'
                : 'This is the lowest excitation gap.'}
            </p>
          ) : (
            <p>
              No trusted gap headline is available. An under-resolved number in
              the table is diagnostic only.
            </p>
          )}
          <p>
            Finite-β transfer correlator:{' '}
            <strong>{result.correlatorStatus}</strong>.{' '}
            {result.correlatorReasons.join(' ') ||
              'Checked at zero, quarter-circle and midpoint lag.'}{' '}
            Thermal mean {formatNumber(result.grids[2].mean)}.
          </p>
          {result.correlatorStatus === 'resolved' && (
            <>
              <Chart
                title="Numerical finite-a thermal transfer C(t)"
                curves={[
                  {
                    label: 'Raw finite-β transfer reference',
                    color: '#14625a',
                    points: result.grids[2].rawCorrelator!.map(
                      (value, lag) =>
                        [(lag * p.beta) / p.sites, value] as [number, number],
                    ),
                  },
                  ...(p.h !== 0
                    ? [
                        {
                          label: 'Connected thermal transfer reference',
                          color: '#9d4363',
                          dashed: true,
                          points: result.grids[2].connectedCorrelator!.map(
                            (value, lag) =>
                              [(lag * p.beta) / p.sites, value] as [
                                number,
                                number,
                              ],
                          ),
                        },
                      ]
                    : []),
                ]}
                xMin={0}
                xMax={p.beta / 2}
                xLabel="t="
              />
              <p>
                Numerical finite-spacing transfer reference: C(0)=
                {formatNumber(result.grids[2].rawCorrelator?.[0] ?? null)};
                C(β/2)=
                {formatNumber(result.grids[2].rawCorrelator?.at(-1) ?? null)}.
              </p>
            </>
          )}
          {p.lambda === 0 && (
            <p>
              Analytic finite-a displaced-harmonic reference: Ωₐ=
              {formatNumber(harmonicLimitReference(p, 0).gap)}, 〈x〉=
              {formatNumber(harmonicLimitReference(p, 0).mean)}, raw C(0)=
              {formatNumber(harmonicLimitReference(p, 0).raw)}, raw C(β/2)=
              {formatNumber(
                harmonicLimitReference(p, Math.floor(p.sites / 2)).raw,
              )}
              .
            </p>
          )}
          <p className="plot-note">
            Finite-a T is a symmetric Trotter operator, not exact exp(−aH).
            Successive quadratures give practical convergence evidence, not a
            rigorous error bound. The MC update operator has a different
            spectrum.
          </p>
        </>
      )}
    </section>
  );
}
