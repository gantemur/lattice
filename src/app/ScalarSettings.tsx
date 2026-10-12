import { useEffect, useState } from 'react';
import type { Settings, Sampler } from '../algorithms/transitions';
import type { ScalarModel } from '../models/scalarField';
export function ScalarSettings({
  settings,
  seed,
  setSeed,
  apply,
  disabled,
}: {
  settings: Settings;
  seed: string;
  setSeed: (v: string) => void;
  apply: (s: Settings) => void;
  disabled: boolean;
}) {
  const model = settings.model as ScalarModel;
  const [kind, setKind] = useState<Sampler['kind']>(settings.sampler.kind);
  const [width, setWidth] = useState(
    settings.sampler.kind === 'metropolis'
      ? String(settings.sampler.width)
      : '1',
  );
  const [warmup, setWarmup] = useState(
    settings.sampler.kind === 'direct'
      ? '200'
      : String(settings.sampler.warmup ?? 200),
  );
  const appliedSampler = JSON.stringify(settings.sampler);
  // Only an applied sampler change replaces local drafts. Worker snapshots from
  // ordinary sampling leave uncommitted width and warm-up edits untouched.
  useEffect(() => {
    const sampler = settings.sampler;
    setKind(sampler.kind);
    setWidth(sampler.kind === 'metropolis' ? String(sampler.width) : '1');
    setWarmup(sampler.kind === 'direct' ? '200' : String(sampler.warmup));
  }, [appliedSampler]);
  const gaussian = model.parameters.domain.vertices.every(
    (v) => model.parameters.lambda[v.id] === 0,
  );
  return (
    <details className="settings">
      <summary>Model & sampler settings</summary>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          apply({
            model,
            sampler:
              kind === 'direct'
                ? { kind }
                : kind === 'heat-bath'
                  ? { kind, warmup: Number(warmup) }
                  : { kind, width: Number(width), warmup: Number(warmup) },
          });
        }}
      >
        <label>
          Sampling algorithm
          <select
            aria-label="Sampling algorithm"
            value={kind}
            onChange={(e) => setKind(e.target.value as Sampler['kind'])}
          >
            {gaussian && (
              <option value="direct">Direct multivariate Gaussian</option>
            )}
            {gaussian && (
              <option value="heat-bath">Coordinate Gaussian heat bath</option>
            )}
            <option value="metropolis">Random-site Metropolis</option>
          </select>
        </label>
        {kind === 'metropolis' && (
          <label>
            Proposal half-width δ
            <input
              aria-label="Proposal half-width δ"
              type="number"
              step="any"
              min="0.01"
              max="50"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </label>
        )}
        {kind !== 'direct' && (
          <label>
            Warm-up updates
            <input
              aria-label="Warm-up updates"
              type="number"
              min="0"
              max="10000"
              value={warmup}
              onChange={(e) => setWarmup(e.target.value)}
            />
          </label>
        )}
        <p className="settings-warning">
          One random site per local update; N local updates form a nominal
          sweep, not physical time. Direct draws replace the whole vector.
          Warm-up does not prove mixing.
        </p>
        <button className="button primary full" disabled={disabled}>
          Apply settings
        </button>
        <details className="seed-settings">
          <summary>Reset seed</summary>
          <label>
            Seed on Reset
            <input
              aria-label="Seed on Reset"
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
        </details>
      </form>
    </details>
  );
}
