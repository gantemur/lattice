import { useMemo, useState } from 'react';
import type { LatticeSnapshot } from '../engine/latticeRun';
import { finiteChainReference } from '../models/isingChainTransfer';
import { LatticePlotView } from '../plotting/LatticePlots';
import { PlotFrame, formatNumber, tick } from '../plotting/PlotFrame';
import { ToolDeck } from './ToolDeck';
import type { ToolDefinition } from './ToolDeck';
import { SpinChain } from './SpinChain';

type ChainTool =
  | 'chain-spin'
  | 'chain-correlation'
  | 'transfer'
  | 'length'
  | 'finite'
  | 'transition'
  | 'm-history'
  | 'e-history'
  | 'e-histogram'
  | 'm-acf'
  | 'm-blocking'
  | 'acceptance';
const tools: ToolDefinition<ChainTool>[] = [
  {
    id: 'chain-spin',
    title: 'Spin chain configuration',
    kind: 'Visualization',
    description: 'Select a site in a genuine one-dimensional chain.',
  },
  {
    id: 'chain-correlation',
    title: 'Exact versus sampled spatial correlation',
    kind: 'Plot',
    description:
      'Finite-N transfer result and full-segment Monte Carlo pair products.',
  },
  {
    id: 'm-history',
    title: 'Magnetization history',
    kind: 'Plot',
    description: 'Retained measurements in nominal sweeps.',
  },
  {
    id: 'transfer',
    title: 'Transfer matrix and eigenvalues',
    kind: 'Analysis',
    description: 'The 2×2 spatial transfer matrix.',
  },
  {
    id: 'length',
    title: 'Bulk correlation length',
    kind: 'Analysis',
    description: 'Signed eigenvalue ratio and infinite-chain decay length.',
  },
  {
    id: 'finite',
    title: 'Exact finite-chain observables',
    kind: 'Analysis',
    description:
      'Partition function, magnetization, energy and susceptibility.',
  },
  {
    id: 'e-history',
    title: 'Energy density history',
    kind: 'Plot',
    description: 'Physical H/N by nominal sweep.',
  },
  {
    id: 'e-histogram',
    title: 'Energy histogram',
    kind: 'Plot',
    description: 'Segment-separated physical energy-density measurements.',
  },
  {
    id: 'm-acf',
    title: 'Monte Carlo autocorrelation',
    kind: 'Analysis',
    description:
      'Algorithmic retained-observation lags, not spatial separation.',
  },
  {
    id: 'm-blocking',
    title: 'Monte Carlo blocking SE',
    kind: 'Analysis',
    description: 'Recent-window uncertainty diagnostics.',
  },
  {
    id: 'acceptance',
    title: 'Update outcomes',
    kind: 'Analysis',
    description: 'Local sampler acceptance or resampling outcomes.',
  },
  {
    id: 'transition',
    title: 'Local transition inspection',
    kind: 'Analysis',
    description: 'The latest actual algorithmic update and local flip cost.',
  },
];

export function ChainToolDeck({
  snapshot,
  selected,
  select,
}: {
  snapshot: LatticeSnapshot;
  selected: number;
  select: (site: number) => void;
}) {
  const p = snapshot.configuration.parameters;
  // Only physical parameters invalidate the exact calculation. Tool movement,
  // site selection and new worker measurements never recompute the transfer.
  const reference = useMemo(
    () => finiteChainReference(p),
    [p.lx, p.periodicX, p.jx, p.field, p.temperature],
  );
  const [windowSize, setWindowSize] = useState(100);
  return (
    <ToolDeck
      title="Ising chain tools"
      tools={tools}
      featuredDefault="chain-spin"
      defaults={['chain-correlation', 'm-history']}
      renderSharedControls={(_, active) =>
        active.some((id) => id.endsWith('history')) && (
          <label className="plot-controls">
            History window
            <select
              aria-label="Chain history window"
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value))}
            >
              <option value="100">Latest 100 sweeps</option>
              <option value="500">Latest 500 sweeps</option>
              <option value="1000">Latest 1000 sweeps</option>
            </select>
          </label>
        )
      }
      renderTool={(tool) => {
        if (tool === 'chain-spin')
          return (
            <SpinChain
              snapshot={snapshot}
              selected={selected}
              select={select}
            />
          );
        if (tool === 'chain-correlation')
          return <ChainCorrelation snapshot={snapshot} reference={reference} />;
        if (tool === 'transfer')
          return (
            <div
              className="chain-analysis"
              aria-label="Spatial transfer matrix"
            >
              <p>
                Basis (+1, −1), K=J/T={formatNumber(p.jx / p.temperature)},
                b=h/T={formatNumber(p.field / p.temperature)}.
              </p>
              <p>
                T = [[exp(K+b), exp(−K)], [exp(−K), exp(K−b)]]. Open ends use
                v=(exp(b/2), exp(−b/2)); rings use Tr(Tᴺ).
              </p>
              <p>
                log λ₊ = {formatNumber(reference.spectrum.logLeading)} · λ₋/λ₊ ={' '}
                {formatNumber(reference.spectrum.ratio)} (
                {reference.spectrum.quality}).
              </p>
              <p>
                λ₊ ≈ {reference.spectrum.leading.toExponential(4)} · λ₋ ≈{' '}
                {reference.spectrum.subleading.toExponential(4)}.
              </p>
              <p>
                Normalized eigenvectors: u₊=(
                {reference.spectrum.leadingVector.map(formatNumber).join(', ')}
                ), u₋=(
                {reference.spectrum.otherVector.map(formatNumber).join(', ')}).
              </p>
            </div>
          );
        if (tool === 'length')
          return (
            <div
              className="chain-analysis"
              aria-label="Bulk correlation length"
            >
              <p>
                Infinite homogeneous chain: ξ⁻¹ = −log |λ₋/λ₊|. Here ξ ={' '}
                {formatNumber(reference.spectrum.correlationLength)} sites;
                signed ratio {formatNumber(reference.spectrum.ratio)}.
              </p>
              {reference.spectrum.ratio < 0 && (
                <p>
                  Negative λ₋ gives alternating antiferromagnetic correlations.
                </p>
              )}
              {reference.warning && (
                <p className="settings-warning">{reference.warning}</p>
              )}
              <p>
                No finite-temperature phase transition occurs in this
                nearest-neighbor 1D model. Large ξ is not a finite-T
                singularity.
              </p>
            </div>
          );
        if (tool === 'finite')
          return (
            <div
              className="chain-analysis"
              aria-label="Exact finite-chain observables"
            >
              <p>
                Exact 2×2 transfer calculation: log Z<sub>N</sub>=
                {formatNumber(reference.logPartition)}; 〈m〉=
                {formatNumber(reference.meanMagnetization)}; 〈e=H/N〉=
                {formatNumber(reference.meanEnergy)}.
              </p>
              <p>
                Mean nearest-neighbor product={formatNumber(reference.nearest)};
                finite-volume χ=Var(M)/(NT)=
                {formatNumber(reference.susceptibility)}.
              </p>
              <p>
                Exact nearest-neighbor connected covariance (site-centered)={' '}
                {formatNumber(reference.correlations[1]!.connected)}. The
                default sampled comparison instead shows raw G(r).
              </p>
              {!p.periodicX && (
                <p>
                  Open-end site means vary:{' '}
                  {reference.siteMeans.slice(0, 8).map(formatNumber).join(', ')}
                  {p.lx > 8 ? ' …' : ''}. The plotted raw G(r) averages all
                  valid origins.
                </p>
              )}
              <p>
                These are finite-volume equilibrium values, not heat-capacity or
                Binder references.
              </p>
            </div>
          );
        if (tool === 'transition') {
          const t = snapshot.lastTrace;
          return (
            <div
              className="chain-analysis"
              aria-label="Latest chain transition"
            >
              {t ? (
                <>
                  <p>
                    Update {t.update} at site {t.site}: {t.oldSpin} →{' '}
                    {t.newSpin} ({t.outcome}). Algorithmic update, not physical
                    time.
                  </p>
                  <p>
                    Hypothetical flip ΔH={formatNumber(t.flipDeltaH)}; actual
                    transition ΔH={formatNumber(t.deltaH)}. Local field=
                    {formatNumber(t.field)}.
                  </p>
                  <p>
                    Incident terms:{' '}
                    {t.terms
                      .map(
                        (q) =>
                          `site ${q.neighbor}: ${formatNumber(q.contribution)}`,
                      )
                      .join(' · ') || 'none'}
                    .
                  </p>
                </>
              ) : (
                <p>Step or Run to inspect an actual update.</p>
              )}
            </div>
          );
        }
        return (
          <LatticePlotView
            snapshot={snapshot}
            plot={tool}
            windowSize={windowSize}
            end={snapshot.sweeps}
            spatialMaximum={16}
          />
        );
      }}
    />
  );
}

function ChainCorrelation({
  snapshot,
  reference,
}: {
  snapshot: LatticeSnapshot;
  reference: ReturnType<typeof finiteChainReference>;
}) {
  const segment = snapshot.segments.at(-1)!;
  const exact = reference.correlations;
  const sampled = segment.spatialX.filter(
    (point) => point.moments.mean !== null,
  );
  const max = exact.at(-1)?.r ?? 1;
  return (
    <section
      className="chain-analysis"
      aria-label="Chain spatial correlation comparison"
    >
      <PlotFrame
        label="Exact finite-chain and sampled raw spin correlation by spatial separation"
        viewport={`0:${max}`}
      >
        {(f) => {
          const X = (r: number) =>
            f.left + (r / Math.max(1, max)) * (f.right - f.left);
          const Y = (v: number) =>
            f.bottom - ((v + 1) / 2) * (f.bottom - f.top);
          return (
            <>
              <line
                x1={f.left}
                x2={f.right}
                y1={Y(0)}
                y2={Y(0)}
                stroke="#87958d"
              />
              <line
                x1={f.left}
                x2={f.left}
                y1={f.top}
                y2={f.bottom}
                stroke="#87958d"
              />
              <polyline
                fill="none"
                stroke="#cdbb83"
                strokeWidth="2.5"
                points={exact.map((q) => `${X(q.r)},${Y(q.raw)}`).join(' ')}
              />
              {sampled.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#51ada0"
                  strokeWidth="2"
                  points={sampled
                    .map((q) => `${X(q.r)},${Y(q.moments.mean!)}`)
                    .join(' ')}
                />
              )}
              {sampled.map((q) => (
                <circle
                  key={q.r}
                  cx={X(q.r)}
                  cy={Y(q.moments.mean!)}
                  r="3"
                  fill="#51ada0"
                />
              ))}
              <text x={f.left} y={f.height - 18} fontSize="11">
                r=0
              </text>
              <text
                x={f.right}
                y={f.height - 18}
                textAnchor="end"
                fontSize="11"
              >
                r={max} sites
              </text>
              <text x={f.left + 4} y={f.top + 12} fontSize="11">
                {tick(1)}
              </text>
              <text x={f.left + 4} y={f.bottom - 4} fontSize="11">
                {tick(-1)}
              </text>
            </>
          );
        }}
      </PlotFrame>
      <p>
        Gold: exact finite-{snapshot.spins.length} raw G(r). Teal:{' '}
        {segment.samples} retained measurements from segment {segment.id}, same
        origin/displacement average. No independent-sample error bars for this
        local chain.
      </p>
      <p>
        Bulk ξ and finite-chain curves are distinct. The Monte Carlo transition
        spectrum controls mixing, not this spatial transfer ratio.
      </p>
    </section>
  );
}
