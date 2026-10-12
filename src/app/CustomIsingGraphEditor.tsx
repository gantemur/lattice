import { useEffect, useState } from 'react';
import { customPairIds } from '../domain/graph';
import { customIsingModel } from '../models/ising';
import type { IsingModel } from '../models/ising';

const allPairs = customPairIds(4);
const numeric = (text: string) => (text.trim() ? Number(text) : NaN);

/** Draft-only controls. The featured graph and worker always read the applied model. */
export function CustomIsingGraphEditor({
  model,
  apply,
  disabled,
}: {
  model: IsingModel;
  apply: (model: IsingModel) => void;
  disabled: boolean;
}) {
  const { domain } = model.parameters;
  const [siteCount, setSiteCount] = useState(domain.vertices.length);
  const [present, setPresent] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      allPairs.map((id) => [id, domain.edges.some((edge) => edge.id === id)]),
    ),
  );
  const [couplings, setCouplings] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      allPairs.map((id) => [id, String(model.parameters.couplings[id] ?? 0.5)]),
    ),
  );
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => [
        `v${i}`,
        String(model.parameters.fields[`v${i}`] ?? 0),
      ]),
    ),
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  const parameterKey = JSON.stringify([
    model.parameters.couplings,
    model.parameters.fields,
  ]);
  useEffect(() => {
    // Runs only after an applied parameter change, not after sampling snapshots
    // or presentation changes. Draft values for a disabled pair survive until Apply.
    setCouplings(
      Object.fromEntries(
        allPairs.map((id) => [
          id,
          String(model.parameters.couplings[id] ?? 0.5),
        ]),
      ),
    );
    setFields(
      Object.fromEntries(
        Array.from({ length: 4 }, (_, i) => [
          `v${i}`,
          String(model.parameters.fields[`v${i}`] ?? 0),
        ]),
      ),
    );
  }, [parameterKey]);
  const visiblePairs = customPairIds(siteCount);
  const draftEdges = visiblePairs.filter((id) => present[id]);
  return (
    <details className="graph-editor" id="graph-parameter-editor">
      <summary>Custom graph & numerical parameters</summary>
      <p className="plot-note">
        Draft only: the featured graph and sampling keep the applied{' '}
        {domain.vertices.length}-site,
        {` ${domain.edges.length}`}-bond model until Apply. Presence changes
        topology; a present K=0 bond remains selectable. Disabling a pair
        temporarily keeps its typed K here; after Apply, re-enabling an absent
        pair defaults to K=0.5.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const next = customIsingModel(
              siteCount,
              draftEdges,
              Object.fromEntries(
                draftEdges.map((id) => [id, numeric(couplings[id] ?? '')]),
              ),
              Object.fromEntries(
                Array.from({ length: siteCount }, (_, i) => [
                  `v${i}`,
                  numeric(fields[`v${i}`] ?? ''),
                ]),
              ),
            );
            setDraftError(null);
            apply(next);
          } catch (error) {
            setDraftError(
              error instanceof Error ? error.message : 'Invalid custom graph.',
            );
          }
        }}
      >
        <label>
          Number of spins
          <select
            aria-label="Number of spins"
            value={siteCount}
            disabled={disabled}
            onChange={(event) => setSiteCount(Number(event.target.value))}
          >
            {[2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <div className="graph-fields">
          {Array.from({ length: siteCount }, (_, i) => {
            const id = `v${i}`;
            return (
              <label key={id}>
                Field b at {id}
                <input
                  aria-label={`Field ${id}`}
                  type="number"
                  step="any"
                  min="-10"
                  max="10"
                  disabled={disabled}
                  value={fields[id] ?? ''}
                  onChange={(event) =>
                    setFields({ ...fields, [id]: event.target.value })
                  }
                />
              </label>
            );
          })}
        </div>
        <div className="custom-edge-list" aria-label="Available simple edges">
          {visiblePairs.map((id) => {
            const [, tail, head] = id.split(':');
            return (
              <div className="custom-edge-row" key={id}>
                <label className="custom-edge-presence">
                  <input
                    type="checkbox"
                    aria-label={`Present ${tail}–${head}`}
                    checked={!!present[id]}
                    disabled={disabled}
                    onChange={(event) =>
                      setPresent({ ...present, [id]: event.target.checked })
                    }
                  />
                  Present {tail}–{head}
                </label>
                <label>
                  K
                  <input
                    id={`graph-coupling-${id}`}
                    aria-label={`Coupling ${id}`}
                    type="number"
                    step="any"
                    min="-10"
                    max="10"
                    disabled={disabled}
                    value={couplings[id] ?? ''}
                    onChange={(event) =>
                      setCouplings({ ...couplings, [id]: event.target.value })
                    }
                  />
                </label>
              </div>
            );
          })}
        </div>
        <button className="button primary" disabled={disabled}>
          Apply custom graph
        </button>
        {draftError && (
          <p className="error-message" role="alert">
            {draftError}
          </p>
        )}
        <p className="plot-note">
          Draft: {siteCount} sites · {draftEdges.length} present bonds. K and b:
          −10 to 10. Changing sites or presence starts a seeded session;
          changing only K or b keeps the configuration/RNG and starts a separate
          segment.
        </p>
      </form>
    </details>
  );
}
