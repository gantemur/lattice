import { useState } from 'react';
import type { Snapshot } from '../engine/protocol';
import { conditionalPlus, exactIsing, spinAt } from '../models/ising';
import { formatNumber } from './PlotFrame';
export function IsingMatrix({ snapshot }: { snapshot: Snapshot }) {
  const [connected, setConnected] = useState(true);
  const s = snapshot.segments.at(-1)!;
  if (s.model.kind !== 'ising' || !s.ising) return null;
  const exact = exactIsing(s.model),
    n = s.model.parameters.domain.vertices.length,
    N = s.moments.count;
  const means = Array.from(
    { length: n },
    (_, i) =>
      s.ising!.counts.reduce((sum, c, state) => sum + c * spinAt(state, i), 0) /
      Math.max(1, N),
  );
  return (
    <div className="matrix-scroll">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={connected}
          onChange={(e) => setConnected(e.target.checked)}
        />
        Connected correlations
      </label>
      <table className="moments-table">
        <caption>
          {connected ? 'Connected correlations' : 'Pair correlations'} · exact /
          sampled (current segment)
        </caption>
        <thead>
          <tr>
            <th>Site</th>
            {s.model.parameters.domain.vertices.map((v) => (
              <th key={v.id}>{v.id}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(connected ? exact.covariance : exact.correlations).map((row, i) => (
            <tr key={i}>
              <th>v{i}</th>
              {row.map((c, j) => {
                const sampled =
                  s.ising!.counts.reduce(
                    (sum, k, state) =>
                      sum + k * spinAt(state, i) * spinAt(state, j),
                    0,
                  ) /
                    Math.max(1, N) -
                  (connected ? means[i]! * means[j]! : 0);
                return (
                  <td
                    key={j}
                    style={{
                      background: `rgba(20,98,90,${Math.abs(c) * 0.12})`,
                    }}
                  >
                    {formatNumber(c)} / {formatNumber(N ? sampled : null)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="plot-note">
        {connected ? 'Cᵢⱼ = ⟨sᵢsⱼ⟩ − ⟨sᵢ⟩⟨sⱼ⟩.' : 'Pair = ⟨sᵢsⱼ⟩.'} Every
        retained configuration contributes; warm-up excluded.
      </p>
    </div>
  );
}
export function ConditionalPlot({
  snapshot,
  target,
}: {
  snapshot: Snapshot;
  target: string;
}) {
  const model = snapshot.configuration.model;
  if (model.kind !== 'ising') return null;
  const index = Math.max(
      0,
      model.parameters.domain.vertices.findIndex((v) => v.id === target),
    ),
    state = snapshot.currentValue;
  if (state === null)
    return <p>Step to obtain a configuration for local conditionals.</p>;
  const p = conditionalPlus(model, state, index);
  return (
    <div className="conditional-plot">
      <h3>v{index} · conditional at current neighbors</h3>
      {[
        [-1, 1 - p],
        [1, p],
      ].map(([spin, mass]) => (
        <div key={spin}>
          <span>
            s = {spin}: {formatNumber(mass!)}
          </span>
          <meter
            min="0"
            max="1"
            value={mass}
            aria-label={`Probability of spin ${spin}`}
          />
        </div>
      ))}
      <p className="plot-note">
        Exact conditional probabilities given the current neighboring spins.
        These are not equilibrium marginal probabilities. Self-links cancel.
      </p>
    </div>
  );
}
