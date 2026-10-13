import type { Dispatch, SetStateAction } from 'react';
import type { GaussianFieldConfiguration } from '../engine/fieldRun';
import { fieldMeasure } from '../models/gaussianField';

export function FieldControls({
  draft,
  setDraft,
  seed,
  setSeed,
  onApply,
}: {
  draft: GaussianFieldConfiguration;
  setDraft: Dispatch<SetStateAction<GaussianFieldConfiguration>>;
  seed: string;
  setSeed: (seed: string) => void;
  onApply: () => void;
}) {
  const p = draft.parameters;
  const constrained = fieldMeasure(p) === 'mean-zero';
  const local =
    draft.sampler.kind !== 'direct' && draft.sampler.kind !== 'spectral';
  const updateParameters = (
    patch: Partial<GaussianFieldConfiguration['parameters']>,
  ) =>
    setDraft((old) => ({
      ...old,
      parameters: { ...old.parameters, ...patch },
    }));
  const updateChain = (patch: Partial<{ length: number; periodic: boolean }>) =>
    setDraft((old) => ({
      ...old,
      parameters: {
        ...old.parameters,
        shape:
          old.parameters.shape.kind === 'chain'
            ? { ...old.parameters.shape, ...patch }
            : old.parameters.shape,
      },
    }));
  const updateRectangle = (
    patch: Partial<{
      lx: number;
      ly: number;
      periodicX: boolean;
      periodicY: boolean;
    }>,
  ) =>
    setDraft((old) => ({
      ...old,
      parameters: {
        ...old.parameters,
        shape:
          old.parameters.shape.kind === 'rectangle'
            ? { ...old.parameters.shape, ...patch }
            : old.parameters.shape,
      },
    }));
  return (
    <details className="settings" open>
      <summary>Geometry, action & sampler</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <div className="field-control-pair">
          <button
            type="button"
            className="button"
            onClick={() =>
              setDraft((old) => ({
                ...old,
                parameters: {
                  ...old.parameters,
                  measure: 'ordinary',
                  shape: { kind: 'chain', length: 8, periodic: true },
                  r: 1,
                  kappaX: 1,
                  kappaY: 0,
                  source: 0,
                },
                sampler: { kind: 'spectral' },
                warmupSweeps: 0,
                strideSweeps: 1,
              }))
            }
          >
            Draft massive periodic example
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              setDraft((old) => ({
                ...old,
                parameters: {
                  ...old.parameters,
                  measure: 'mean-zero',
                  shape: { kind: 'chain', length: 8, periodic: true },
                  r: 0,
                  kappaX: 1,
                  kappaY: 0,
                  source: 0,
                },
                sampler: { kind: 'spectral' },
                warmupSweeps: 0,
                strideSweeps: 1,
              }))
            }
          >
            Draft massless mean-zero example
          </button>
        </div>
        <p className="plot-note">
          Examples only edit this draft: chain of 8, periodic, κx=1, j=0,
          spectral draws, no warm-up. The massive example sets r=1; mean-zero
          sets r=0. Apply commits the selected settings.
        </p>
        <label>
          Measure
          <select
            aria-label="Field measure"
            value={fieldMeasure(p)}
            onChange={(event) =>
              setDraft((old) =>
                event.target.value === 'mean-zero'
                  ? {
                      ...old,
                      parameters: {
                        ...old.parameters,
                        measure: 'mean-zero',
                        r: 0,
                        source: 0,
                        shape:
                          old.parameters.shape.kind === 'chain'
                            ? { ...old.parameters.shape, periodic: true }
                            : {
                                ...old.parameters.shape,
                                periodicX: true,
                                periodicY: true,
                              },
                        kappaX: Math.max(1, old.parameters.kappaX),
                        kappaY:
                          old.parameters.shape.kind === 'rectangle'
                            ? Math.max(1, old.parameters.kappaY)
                            : old.parameters.kappaY,
                      },
                      sampler: { kind: 'spectral' },
                      warmupSweeps: 0,
                      strideSweeps: 1,
                    }
                  : {
                      ...old,
                      parameters: {
                        ...old.parameters,
                        measure: 'ordinary',
                        r: 1,
                      },
                      sampler: { kind: 'direct' },
                      warmupSweeps: 0,
                      strideSweeps: 1,
                    },
              )
            }
          >
            <option value="ordinary">Ordinary massive</option>
            <option value="mean-zero">Mean-zero massless</option>
          </select>
        </label>
        <label>
          Dimension
          <select
            aria-label="Field dimension"
            value={p.shape.kind}
            onChange={(event) =>
              setDraft((old) => ({
                ...old,
                parameters: {
                  ...old.parameters,
                  shape:
                    event.target.value === 'chain'
                      ? { kind: 'chain', length: 8, periodic: false }
                      : {
                          kind: 'rectangle',
                          lx: 4,
                          ly: 4,
                          periodicX: false,
                          periodicY: false,
                        },
                },
              }))
            }
          >
            <option value="chain">1D chain</option>
            <option value="rectangle">2D rectangle</option>
          </select>
        </label>
        {p.shape.kind === 'chain' ? (
          <>
            <label>
              Sites (2–64)
              <input
                aria-label="Chain sites"
                type="number"
                min="2"
                max="64"
                step="1"
                value={p.shape.length}
                onChange={(event) =>
                  updateChain({ length: Number(event.target.value) })
                }
              />
            </label>
            <label className="field-check">
              <input
                type="checkbox"
                checked={p.shape.periodic}
                onChange={(event) =>
                  updateChain({ periodic: event.target.checked })
                }
              />{' '}
              Periodic chain
            </label>
          </>
        ) : (
          <>
            <div className="field-control-pair">
              <label>
                Width Lx (2–8)
                <input
                  aria-label="Field width"
                  type="number"
                  min="2"
                  max="8"
                  step="1"
                  value={p.shape.lx}
                  onChange={(event) =>
                    updateRectangle({ lx: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Height Ly (2–8)
                <input
                  aria-label="Field height"
                  type="number"
                  min="2"
                  max="8"
                  step="1"
                  value={p.shape.ly}
                  onChange={(event) =>
                    updateRectangle({ ly: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <label className="field-check">
              <input
                type="checkbox"
                checked={p.shape.periodicX}
                onChange={(event) =>
                  updateRectangle({ periodicX: event.target.checked })
                }
              />{' '}
              Periodic x
            </label>
            <label className="field-check">
              <input
                type="checkbox"
                checked={p.shape.periodicY}
                onChange={(event) =>
                  updateRectangle({ periodicY: event.target.checked })
                }
              />{' '}
              Periodic y
            </label>
          </>
        )}
        <div className="field-control-pair">
          <label>
            Quadratic r
            <input
              aria-label="Field mass coefficient r"
              type="number"
              min={constrained ? '0' : '0.05'}
              max="20"
              step="any"
              value={p.r}
              disabled={constrained}
              onChange={(event) =>
                updateParameters({ r: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Stiffness κx
            <input
              aria-label="Horizontal stiffness"
              type="number"
              min="0"
              max="10"
              step="any"
              value={p.kappaX}
              onChange={(event) =>
                updateParameters({ kappaX: Number(event.target.value) })
              }
            />
          </label>
        </div>
        {p.shape.kind === 'rectangle' && (
          <label>
            Stiffness κy
            <input
              aria-label="Vertical stiffness"
              type="number"
              min="0"
              max="10"
              step="any"
              value={p.kappaY}
              onChange={(event) =>
                updateParameters({ kappaY: Number(event.target.value) })
              }
            />
          </label>
        )}
        <label>
          Uniform source j
          <input
            aria-label="Field source"
            type="number"
            min="-10"
            max="10"
            step="any"
            value={p.source}
            disabled={constrained}
            onChange={(event) =>
              updateParameters({ source: Number(event.target.value) })
            }
          />
        </label>
        <label>
          Sampler
          <select
            aria-label="Field update method"
            value={draft.sampler.kind}
            onChange={(event) => {
              const kind = event.target.value;
              setDraft((old) => ({
                ...old,
                sampler:
                  kind === 'metropolis'
                    ? { kind: 'metropolis', width: 1 }
                    : kind === 'heat-bath'
                      ? { kind: 'heat-bath' }
                      : kind === 'spectral'
                        ? { kind: 'spectral' }
                        : { kind: 'direct' },
                warmupSweeps: kind === 'direct' || kind === 'spectral' ? 0 : 20,
                strideSweeps: 1,
              }));
            }}
          >
            {!constrained && (
              <option value="direct">
                Independent Gaussian draws (Cholesky)
              </option>
            )}
            <option value="spectral">
              Independent spectral Gaussian draws
            </option>
            {!constrained && (
              <option value="heat-bath">Random-site Gaussian heat bath</option>
            )}
            {!constrained && (
              <option value="metropolis">Random-site Metropolis</option>
            )}
          </select>
        </label>
        {draft.sampler.kind === 'metropolis' && (
          <label>
            Proposal half-width δ
            <input
              aria-label="Field proposal width"
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
          <div className="field-control-pair">
            <label>
              Warm-up sweeps
              <input
                aria-label="Field thermalization sweeps"
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
              Stride sweeps
              <input
                aria-label="Field measurement spacing"
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
          </div>
        )}
        <label>
          Seed on Reset
          <input
            aria-label="Field reset seed"
            type="number"
            min="0"
            max="4294967295"
            step="1"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
          />
        </label>
        <button type="submit" className="button">
          Apply parameters
        </button>
      </form>
    </details>
  );
}
