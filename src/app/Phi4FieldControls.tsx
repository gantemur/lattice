import { useRef } from 'react';
import type {
  Phi4FieldConfiguration,
  Phi4FieldSettings,
  Phi4HmcSettings,
  Phi4MetropolisSettings,
} from '../engine/fieldRun';
import {
  defaultPhi4Configuration,
  isFieldHmcSettings,
} from '../engine/fieldRun';
import type { Phi4FieldParameters } from '../models/phi4Field';
import { DisplayMath } from '../ui/Math';

const presets: { name: string; parameters: Phi4FieldParameters }[] = [
  {
    name: 'Periodic interacting chain',
    parameters: defaultPhi4Configuration.parameters,
  },
  {
    name: '2D single well',
    parameters: {
      ...defaultPhi4Configuration.parameters,
      shape: {
        kind: 'rectangle',
        lx: 4,
        ly: 4,
        periodicX: true,
        periodicY: true,
      },
      r: 1,
      lambda: 1,
      kappaX: 1,
      kappaY: 1,
    },
  },
  {
    name: '2D symmetric double well',
    parameters: {
      ...defaultPhi4Configuration.parameters,
      shape: {
        kind: 'rectangle',
        lx: 4,
        ly: 4,
        periodicX: true,
        periodicY: true,
      },
      r: -1,
      lambda: 0.5,
      kappaX: 1,
      kappaY: 1,
    },
  },
  {
    name: 'Tilted double well',
    parameters: { ...defaultPhi4Configuration.parameters, source: 0.2 },
  },
  {
    name: 'Decoupled quartic sites',
    parameters: {
      ...defaultPhi4Configuration.parameters,
      r: 1,
      lambda: 1,
      kappaX: 0,
    },
  },
  {
    name: 'Gaussian limit',
    parameters: { ...defaultPhi4Configuration.parameters, r: 1, lambda: 0 },
  },
];
/** Draft controls never mutate applied parameters or issue sampling commands. */
export function Phi4FieldControls({
  applied,
  draft,
  setDraft,
  seed,
  setSeed,
  apply,
}: {
  applied: Phi4FieldSettings;
  draft: Phi4FieldConfiguration;
  setDraft: (draft: Phi4FieldConfiguration) => void;
  seed: string;
  setSeed: (seed: string) => void;
  apply: () => void;
}) {
  // Remember each algorithm's draft tuning without putting both cadence
  // systems in the applied worker settings. Presets change physics only.
  const localDraft = useRef({
    sampler: defaultPhi4Configuration.sampler,
    warmupSweeps: 20,
    strideSweeps: 1,
  });
  const hmcDraft = useRef({
    sampler: { kind: 'hmc' as const, stepSize: 0.06, leapfrogSteps: 12 },
    warmupTrajectories: 20,
    strideTrajectories: 1,
  });
  const hmc = isFieldHmcSettings(draft) ? draft : null;
  const local = !isFieldHmcSettings(draft) ? draft : null;
  if (hmc)
    hmcDraft.current = {
      sampler: hmc.sampler,
      warmupTrajectories: hmc.warmupTrajectories,
      strideTrajectories: hmc.strideTrajectories,
    };
  if (local)
    localDraft.current = {
      sampler: local.sampler,
      warmupSweeps: local.warmupSweeps,
      strideSweeps: local.strideSweeps,
    };
  function chooseSampler(kind: string) {
    const base = {
      model: 'phi4-field' as const,
      parameters: draft.parameters,
      seed: draft.seed,
    };
    setDraft(
      kind === 'hmc'
        ? { ...base, ...hmcDraft.current }
        : { ...base, ...localDraft.current },
    );
  }
  function hmcTuning(
    patch: Partial<
      Pick<
        Phi4HmcSettings,
        'sampler' | 'warmupTrajectories' | 'strideTrajectories'
      >
    >,
  ) {
    if (hmc) setDraft({ ...hmc, ...patch });
  }
  function localTuning(
    patch: Partial<
      Pick<Phi4MetropolisSettings, 'sampler' | 'warmupSweeps' | 'strideSweeps'>
    >,
  ) {
    if (local) setDraft({ ...local, ...patch });
  }
  const p = draft.parameters,
    shape = p.shape;
  function parameter(patch: Partial<Phi4FieldParameters>) {
    setDraft({ ...draft, parameters: { ...p, ...patch } });
  }
  function number(
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
    step: number | string = 'any',
  ) {
    return (
      <label>
        {label}
        <input
          aria-label={label}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          required
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
      </label>
    );
  }
  return (
    <aside className="sidebar" aria-label="Spatial quartic settings">
      <section className="model-card">
        <p className="eyebrow">Dimensionless spatial action</p>
        <DisplayMath>{String.raw`\begin{aligned}S={}&\sum_i\left(\tfrac r2\phi_i^2+\tfrac\lambda4\phi_i^4\right)\\&-j\sum_i\phi_i\\&+\tfrac12\sum_b\kappa_b(\phi_t-\phi_h)^2\end{aligned}`}</DisplayMath>
        <p>
          Weight exp(−S) with ordinary product Lebesgue measure. The constant
          mode fluctuates; there is no extra temperature factor.
        </p>
        <p data-testid="phi4-applied">
          Applied: r={applied.parameters.r}, λ={applied.parameters.lambda}, κx=
          {applied.parameters.kappaX}
          {applied.parameters.shape.kind === 'rectangle' &&
            `, κy=${applied.parameters.kappaY}`}
          , j={applied.parameters.source}.{' '}
          {isFieldHmcSettings(applied)
            ? `HMC ε=${applied.sampler.stepSize}, L=${applied.sampler.leapfrogSteps}; warm-up ${applied.warmupTrajectories}, stride ${applied.strideTrajectories} trajectories.`
            : `Local Metropolis width ${applied.sampler.width}; warm-up ${applied.warmupSweeps}, stride ${applied.strideSweeps} nominal sweeps.`}
        </p>
      </section>
      <details className="settings" open>
        <summary>Edit spatial φ⁴ settings</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <label>
            Teaching preset
            <select
              aria-label="Spatial teaching preset"
              value=""
              onChange={(e) => {
                const preset = presets[Number(e.target.value)];
                if (preset) parameter(structuredClone(preset.parameters));
              }}
            >
              <option value="" disabled>
                Fill draft…
              </option>
              {presets.map((preset, i) => (
                <option key={preset.name} value={i}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Geometry
            <select
              aria-label="Spatial geometry"
              value={shape.kind}
              onChange={(e) =>
                parameter({
                  shape:
                    e.target.value === 'chain'
                      ? { kind: 'chain', length: 16, periodic: true }
                      : {
                          kind: 'rectangle',
                          lx: 4,
                          ly: 4,
                          periodicX: true,
                          periodicY: true,
                        },
                  kappaY: e.target.value === 'chain' ? 0 : 1,
                })
              }
            >
              <option value="chain">1D chain</option>
              <option value="rectangle">2D rectangle</option>
            </select>
          </label>
          {shape.kind === 'chain' ? (
            <>
              {number(
                'Spatial sites N',
                shape.length,
                2,
                64,
                (length) => parameter({ shape: { ...shape, length } }),
                1,
              )}
              <label>
                Spatial boundary
                <select
                  aria-label="Spatial boundary"
                  value={String(shape.periodic)}
                  onChange={(e) =>
                    parameter({
                      shape: { ...shape, periodic: e.target.value === 'true' },
                    })
                  }
                >
                  <option value="false">Open</option>
                  <option value="true">Periodic</option>
                </select>
              </label>
            </>
          ) : (
            <>
              {number(
                'Spatial Lx',
                shape.lx,
                2,
                8,
                (lx) => parameter({ shape: { ...shape, lx } }),
                1,
              )}
              {number(
                'Spatial Ly',
                shape.ly,
                2,
                8,
                (ly) => parameter({ shape: { ...shape, ly } }),
                1,
              )}
              {(['X', 'Y'] as const).map((axis) => (
                <label key={axis}>
                  Boundary {axis}
                  <select
                    aria-label={`Spatial boundary ${axis}`}
                    value={String(shape[`periodic${axis}`])}
                    onChange={(e) =>
                      parameter({
                        shape: {
                          ...shape,
                          [`periodic${axis}`]: e.target.value === 'true',
                        },
                      })
                    }
                  >
                    <option value="false">Open</option>
                    <option value="true">Periodic</option>
                  </select>
                </label>
              ))}
            </>
          )}
          {number('Spatial r', p.r, -4, 20, (r) => parameter({ r }))}
          {number('Spatial λ', p.lambda, 0, 4, (lambda) =>
            parameter({ lambda }),
          )}
          {number('Spatial κx', p.kappaX, 0, 10, (kappaX) =>
            parameter({ kappaX }),
          )}
          {shape.kind === 'rectangle' &&
            number('Spatial κy', p.kappaY, 0, 10, (kappaY) =>
              parameter({ kappaY }),
            )}
          {number('Spatial source j', p.source, -10, 10, (source) =>
            parameter({ source }),
          )}
          <label>
            Sampling algorithm
            <select
              aria-label="Spatial sampler"
              value={draft.sampler.kind}
              onChange={(e) => chooseSampler(e.target.value)}
            >
              <option value="metropolis">Local Metropolis</option>
              <option value="hmc">Hamiltonian Monte Carlo</option>
            </select>
          </label>
          {hmc ? (
            <>
              {number(
                'Spatial HMC step size',
                hmc.sampler.stepSize,
                0.002,
                0.25,
                (stepSize) =>
                  hmcTuning({ sampler: { ...hmc.sampler, stepSize } }),
              )}
              {number(
                'Spatial HMC leapfrog steps',
                hmc.sampler.leapfrogSteps,
                1,
                32,
                (leapfrogSteps) =>
                  hmcTuning({ sampler: { ...hmc.sampler, leapfrogSteps } }),
                1,
              )}
              <p className="plot-note">
                Draft auxiliary duration Lε ={' '}
                {(hmc.sampler.stepSize * hmc.sampler.leapfrogSteps).toPrecision(
                  4,
                )}
                . Stiff fields may need a smaller ε; settings are never
                automatically retuned.
              </p>
              {number(
                'Spatial HMC warm-up trajectories',
                hmc.warmupTrajectories,
                0,
                1000,
                (warmupTrajectories) => hmcTuning({ warmupTrajectories }),
                1,
              )}
              {number(
                'Spatial HMC measurement stride',
                hmc.strideTrajectories,
                1,
                100,
                (strideTrajectories) => hmcTuning({ strideTrajectories }),
                1,
              )}
            </>
          ) : (
            local && (
              <>
                {number(
                  'Spatial proposal width',
                  local.sampler.width,
                  0.01,
                  10,
                  (width) =>
                    localTuning({ sampler: { kind: 'metropolis', width } }),
                )}
                {number(
                  'Spatial warm-up sweeps',
                  local.warmupSweeps,
                  0,
                  1000,
                  (warmupSweeps) => localTuning({ warmupSweeps }),
                  1,
                )}
                {number(
                  'Spatial measurement stride',
                  local.strideSweeps,
                  1,
                  100,
                  (strideSweeps) => localTuning({ strideSweeps }),
                  1,
                )}
              </>
            )
          )}
          <label>
            Seed on Reset
            <input
              aria-label="Spatial seed on Reset"
              type="number"
              min="0"
              max="4294967295"
              step="1"
              required
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            Apply spatial settings
          </button>
          <p className="plot-note">
            λ=0 requires r≥0.05; otherwise λ≥0.01. Negative r is allowed with
            λ&gt;0. Presets edit only this draft. Parameters preserve field/RNG
            in a new segment; geometry changes start a seeded session.
          </p>
        </form>
      </details>
    </aside>
  );
}
