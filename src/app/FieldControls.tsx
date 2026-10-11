import type { Dispatch, SetStateAction } from 'react';
import type { FieldConfiguration } from '../engine/fieldRun';

export function FieldControls({
  draft,
  setDraft,
  seed,
  setSeed,
  onApply,
}: {
  draft: FieldConfiguration;
  setDraft: Dispatch<SetStateAction<FieldConfiguration>>;
  seed: string;
  setSeed: (seed: string) => void;
  onApply: () => void;
}) {
  const p = draft.parameters;
  const local = draft.sampler.kind !== 'direct';
  const updateParameters = (patch: Partial<FieldConfiguration['parameters']>) =>
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
              min="0.05"
              max="20"
              step="any"
              value={p.r}
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
                      : { kind: 'direct' },
                warmupSweeps: kind === 'direct' ? 0 : 20,
                strideSweeps: 1,
              }));
            }}
          >
            <option value="direct">Independent Gaussian draws</option>
            <option value="heat-bath">Random-site Gaussian heat bath</option>
            <option value="metropolis">Random-site Metropolis</option>
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
