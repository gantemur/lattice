import type { Dispatch, SetStateAction } from 'react';
import type { QuarticConfiguration } from '../engine/fieldRun';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import { DisplayMath, InlineMath } from '../ui/Math';

const presets: Record<
  string,
  Pick<QuarticOscillatorParameters, 'r' | 'lambda' | 'h'>
> = {
  'Gaussian limit': { r: 1, lambda: 0, h: 0 },
  'Single-well quartic': { r: 1, lambda: 1, h: 0 },
  'Symmetric double well': { r: -2, lambda: 1, h: 0 },
  'Tilted double well': { r: -2, lambda: 1, h: 0.4 },
};

/** Draft controls are presentation state; only Apply changes the worker target. */
export function QuarticOscillatorControls({
  p,
  draft,
  setDraft,
  seed,
  setSeed,
  apply,
}: {
  p: QuarticOscillatorParameters;
  draft: QuarticConfiguration;
  setDraft: Dispatch<SetStateAction<QuarticConfiguration>>;
  seed: string;
  setSeed: (value: string) => void;
  apply: () => void;
}) {
  const changePhysical = (
    key: keyof QuarticOscillatorParameters,
    value: number,
  ) =>
    setDraft((old) => ({ ...old, quartic: { ...old.quartic, [key]: value } }));
  return (
    <aside className="sidebar" aria-label="Quartic oscillator settings">
      <section className="model-card">
        <p className="eyebrow">Applied physical path action · ℏ=kB=m=1</p>
        <DisplayMath>{String.raw`\begin{aligned}S_a(x)={}&\sum_j\frac{(x_{j+1}-x_j)^2}{2a}\\&+a\sum_jV(x_j)\end{aligned}`}</DisplayMath>
        <DisplayMath>{String.raw`V(x)=\frac r2x^2+\frac\lambda4x^4-hx`}</DisplayMath>
        <p>
          a=β/N, xₙ=x₀. Target{' '}
          <InlineMath>{String.raw`e^{-S_a(x)}\prod_{j=0}^{N-1}dx_j`}</InlineMath>
          . The closing point is not another variable; the constant path mode
          fluctuates.
        </p>
        <p>
          Applied: N={p.sites}, β={p.beta}, r={p.r}, λ={p.lambda}, h={p.h}.
        </p>
      </section>
      <details className="settings" open>
        <summary>Physical parameters &amp; sampler</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <label>
            Teaching preset
            <select
              aria-label="Quartic preset"
              defaultValue="Symmetric double well"
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  quartic: {
                    ...old.quartic,
                    ...presets[event.target.value]!,
                  },
                }))
              }
            >
              {Object.keys(presets).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          {(
            [
              ['sites', 'Time sites N (4–64)', 4, 64, 1],
              ['beta', 'Inverse temperature β (2–16)', 2, 16, 'any'],
              ['r', 'Quadratic r (−4–16)', -4, 16, 'any'],
              ['lambda', 'Quartic λ (0 or 0.05–4)', 0, 4, 'any'],
              ['h', 'Tilt h (−2–2)', -2, 2, 'any'],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <label key={key}>
              {label}
              <input
                aria-label={`Quartic ${key}`}
                type="number"
                min={min}
                max={max}
                step={step}
                value={draft.quartic[key]}
                onChange={(event) =>
                  changePhysical(key, Number(event.target.value))
                }
              />
            </label>
          ))}
          <label>
            Proposal width (0.01–10)
            <input
              aria-label="Quartic proposal width"
              type="number"
              min="0.01"
              max="10"
              step="any"
              value={
                draft.sampler.kind === 'metropolis' ? draft.sampler.width : 1
              }
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  sampler: {
                    kind: 'metropolis',
                    width: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label>
            Warm-up nominal sweeps (0–1000)
            <input
              aria-label="Quartic warm-up sweeps"
              type="number"
              min="0"
              max="1000"
              step="1"
              value={draft.warmupSweeps}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  warmupSweeps: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Measurement stride in sweeps (1–100)
            <input
              aria-label="Quartic stride sweeps"
              type="number"
              min="1"
              max="100"
              step="1"
              value={draft.strideSweeps}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  strideSweeps: Number(event.target.value),
                }))
              }
            />
          </label>
          <label>
            Seed
            <input
              aria-label="Quartic seed"
              type="number"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
          </label>
          <button className="button" type="submit">
            Apply parameters
          </button>
          <p className="plot-note">
            Presets edit the draft. Applying a changed measure starts a separate
            segment. Warm-up is a budget, not a mixing guarantee.
          </p>
        </form>
      </details>
    </aside>
  );
}
