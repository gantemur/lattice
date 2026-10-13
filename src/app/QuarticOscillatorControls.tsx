import type { Dispatch, SetStateAction } from 'react';
import type { QuarticFieldSettings } from '../engine/fieldRun';
import type { QuarticHmcSampler } from '../algorithms/quarticHmc';
import type { QuarticOscillatorParameters } from '../models/quarticOscillator';
import { formatNumber } from '../plotting/PlotFrame';
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

/** Draft-only form values can remember both cadence systems. Applying builds
 * one strict worker-settings variant, so sweeps never become trajectories. */
export type QuarticDraft = {
  quartic: QuarticOscillatorParameters;
  sampler: { kind: 'metropolis'; width: number } | QuarticHmcSampler;
  warmupSweeps: number;
  strideSweeps: number;
  warmupTrajectories: number;
  strideTrajectories: number;
};

/** Draft controls are presentation state; only Apply changes the worker target. */
export function QuarticOscillatorControls({
  p,
  appliedSettings,
  draft,
  setDraft,
  seed,
  setSeed,
  apply,
}: {
  p: QuarticOscillatorParameters;
  appliedSettings: QuarticFieldSettings | null;
  draft: QuarticDraft;
  setDraft: Dispatch<SetStateAction<QuarticDraft>>;
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
        <p>
          Applied sampler:{' '}
          <strong>
            {appliedSettings?.sampler.kind === 'hmc'
              ? `HMC, ε=${appliedSettings.sampler.stepSize}, L=${appliedSettings.sampler.leapfrogSteps}`
              : 'Local Metropolis'}
          </strong>
          .
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
            Sampling algorithm
            <select
              aria-label="Quartic sampler"
              value={draft.sampler.kind}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  sampler:
                    event.target.value === 'hmc'
                      ? { kind: 'hmc', stepSize: 0.1, leapfrogSteps: 12 }
                      : { kind: 'metropolis', width: 1 },
                }))
              }
            >
              <option value="metropolis">Local Metropolis</option>
              <option value="hmc">Hamiltonian Monte Carlo (HMC)</option>
            </select>
          </label>
          {draft.sampler.kind === 'metropolis' ? (
            <>
              <label>
                Proposal width (0.01–10)
                <input
                  aria-label="Quartic proposal width"
                  type="number"
                  min="0.01"
                  max="10"
                  step="any"
                  value={draft.sampler.width}
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
            </>
          ) : (
            <>
              <label>
                Leapfrog step size ε (0.002–0.25)
                <input
                  aria-label="HMC step size"
                  type="number"
                  min="0.002"
                  max="0.25"
                  step="any"
                  value={draft.sampler.stepSize}
                  onChange={(event) =>
                    setDraft((old) => ({
                      ...old,
                      sampler: {
                        kind: 'hmc',
                        stepSize: Number(event.target.value),
                        leapfrogSteps:
                          old.sampler.kind === 'hmc'
                            ? old.sampler.leapfrogSteps
                            : 12,
                      },
                    }))
                  }
                />
              </label>
              <label>
                Leapfrog steps L (1–32)
                <input
                  aria-label="HMC leapfrog steps"
                  type="number"
                  min="1"
                  max="32"
                  step="1"
                  value={draft.sampler.leapfrogSteps}
                  onChange={(event) =>
                    setDraft((old) => ({
                      ...old,
                      sampler: {
                        kind: 'hmc',
                        stepSize:
                          old.sampler.kind === 'hmc'
                            ? old.sampler.stepSize
                            : 0.1,
                        leapfrogSteps: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <p className="plot-note">
                Auxiliary trajectory duration Lε=
                {formatNumber(
                  draft.sampler.leapfrogSteps * draft.sampler.stepSize,
                )}
                . Each trajectory refreshes N independent Gaussian momenta.
              </p>
              <label>
                Warm-up trajectories (0–1000)
                <input
                  aria-label="HMC warm-up trajectories"
                  type="number"
                  min="0"
                  max="1000"
                  step="1"
                  value={draft.warmupTrajectories}
                  onChange={(event) =>
                    setDraft((old) => ({
                      ...old,
                      warmupTrajectories: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Measurement stride in trajectories (1–100)
                <input
                  aria-label="HMC stride trajectories"
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={draft.strideTrajectories}
                  onChange={(event) =>
                    setDraft((old) => ({
                      ...old,
                      strideTrajectories: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </>
          )}
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
