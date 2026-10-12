import type { Dispatch, SetStateAction } from 'react';
import type { OscillatorConfiguration } from '../engine/fieldRun';
import type { OscillatorParameters } from '../models/oscillator';
import { formatNumber } from '../plotting/PlotFrame';
import { DisplayMath, InlineMath } from '../ui/Math';

/** Physical inputs live in a draft; Apply alone changes the worker target. */
export function OscillatorControls({
  draft,
  setDraft,
  seed,
  setSeed,
  apply,
  p,
  a,
}: {
  draft: OscillatorConfiguration;
  setDraft: Dispatch<SetStateAction<OscillatorConfiguration>>;
  seed: string;
  setSeed: (value: string) => void;
  apply: () => void;
  p: OscillatorParameters;
  a: number;
}) {
  const local =
    draft.sampler.kind === 'heat-bath' || draft.sampler.kind === 'metropolis';
  return (
    <aside className="sidebar" aria-label="Oscillator settings">
      <section className="model-card">
        <p className="eyebrow">Physical path action · ℏ=kB=m=1</p>
        <DisplayMath>{String.raw`\begin{aligned}S_a(x)={}&\sum_{j=0}^{N-1}\frac{(x_{j+1}-x_j)^2}{2a}\\&+\sum_{j=0}^{N-1}\frac{a\omega^2x_j^2}{2}\end{aligned}`}</DisplayMath>
        <p>
          Periodic xₙ=x₀ closes the path but is not another variable. The target
          is <InlineMath>{String.raw`e^{-S_a}\prod_j dx_j`}</InlineMath>. Its
          constant mode fluctuates.
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
            Time sites N (4–64)
            <input
              aria-label="Oscillator time sites"
              type="number"
              min="4"
              max="64"
              step="1"
              value={draft.oscillator.sites}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  oscillator: {
                    ...old.oscillator,
                    sites: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label>
            Inverse temperature β (2–16)
            <input
              aria-label="Oscillator beta"
              type="number"
              min="2"
              max="16"
              step="any"
              value={draft.oscillator.beta}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  oscillator: {
                    ...old.oscillator,
                    beta: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label>
            Frequency ω (0.25–4)
            <input
              aria-label="Oscillator omega"
              type="number"
              min="0.25"
              max="4"
              step="any"
              value={draft.oscillator.omega}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  oscillator: {
                    ...old.oscillator,
                    omega: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label>
            Sampler
            <select
              aria-label="Oscillator sampler"
              value={draft.sampler.kind}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  sampler:
                    event.target.value === 'metropolis'
                      ? { kind: 'metropolis', width: 1 }
                      : event.target.value === 'heat-bath'
                        ? { kind: 'heat-bath' }
                        : { kind: 'spectral' },
                  warmupSweeps: event.target.value === 'spectral' ? 0 : 20,
                  strideSweeps: 1,
                }))
              }
            >
              <option value="spectral">Independent Fourier paths</option>
              <option value="heat-bath">Coordinate heat bath</option>
              <option value="metropolis">Random-site Metropolis</option>
            </select>
          </label>
          {draft.sampler.kind === 'metropolis' && (
            <label>
              Proposal width
              <input
                aria-label="Oscillator proposal width"
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
          )}
          {local && (
            <>
              <label>
                Warm-up nominal sweeps
                <input
                  aria-label="Oscillator warm-up sweeps"
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
                Measurement stride in sweeps
                <input
                  aria-label="Oscillator stride sweeps"
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
          )}
          <label>
            Reset seed
            <input
              aria-label="Oscillator seed"
              type="number"
              step="1"
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
          </label>
          <button className="button" type="submit">
            Apply parameters
          </button>
        </form>
      </details>
      <p className="plot-note">
        Applied: a={formatNumber(a)}, r=aω²=
        {formatNumber(a * p.omega ** 2)}, κ=1/a={formatNumber(1 / a)}.
        Oscillator physics has its own validated range; the Gaussian-field
        control bounds do not constrain it.
      </p>
    </aside>
  );
}
