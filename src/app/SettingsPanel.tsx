import { ScalarSettings } from './ScalarSettings';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Settings, Sampler } from '../algorithms/transitions';
import { defaultModel } from '../models/singleVariable';
import type { Model } from '../models/singleVariable';

function ScalarSettingsPanel({
  settings,
  seed,
  setSeed,
  apply,
  disabled,
}: {
  settings: Settings;
  seed: string;
  setSeed: (seed: string) => void;
  apply: (settings: Settings) => void;
  disabled: boolean;
}) {
  const { model, sampler } = settings;
  const [a, setA] = useState(
    model.kind === 'gaussian' ? String(model.parameters.a) : '1',
  );
  const [h, setH] = useState(
    model.kind === 'spin' || model.kind === 'gaussian'
      ? String(model.parameters.h)
      : '0',
  );
  const [n, setN] = useState(
    model.kind === 'binomial' ? String(model.parameters.n) : '20',
  );
  const [p, setP] = useState(
    model.kind === 'binomial' ? String(model.parameters.p) : '0.5',
  );
  const [kind, setKind] = useState<Sampler['kind']>(sampler.kind);
  const [width, setWidth] = useState(
    sampler.kind === 'metropolis' ? String(sampler.width) : '2',
  );
  const [warmup, setWarmup] = useState(
    sampler.kind === 'metropolis' ? String(sampler.warmup) : '200',
  );
  const appliedParameters = JSON.stringify(model.parameters);
  const appliedSampler = JSON.stringify(sampler);
  useEffect(() => {
    setA(model.kind === 'gaussian' ? String(model.parameters.a) : '1');
    setH(
      model.kind === 'gaussian' || model.kind === 'spin'
        ? String(model.parameters.h)
        : '0',
    );
    setN(model.kind === 'binomial' ? String(model.parameters.n) : '20');
    setP(model.kind === 'binomial' ? String(model.parameters.p) : '0.5');
  }, [appliedParameters]);
  useEffect(() => {
    setKind(sampler.kind);
    setWidth(sampler.kind === 'metropolis' ? String(sampler.width) : '2');
    setWarmup(sampler.kind === 'metropolis' ? String(sampler.warmup) : '200');
  }, [appliedSampler]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const number = (s: string) => (s.trim() ? Number(s) : NaN);
    const nextModel: Model =
      model.kind === 'gaussian'
        ? { kind: 'gaussian', parameters: { a: number(a), h: number(h) } }
        : model.kind === 'spin'
          ? { kind: 'spin', parameters: { h: number(h) } }
          : { kind: 'binomial', parameters: { n: number(n), p: number(p) } };
    apply({
      model: nextModel,
      sampler:
        kind === 'metropolis'
          ? {
              kind,
              width: model.kind === 'gaussian' ? number(width) : 1,
              warmup: number(warmup),
            }
          : { kind },
    });
  }
  function preset() {
    const next = defaultModel(model.kind);
    setA('1');
    setH('0');
    setN('20');
    setP('0.5');
    apply({ model: next, sampler: settings.sampler });
    setKind(settings.sampler.kind);
    if (settings.sampler.kind === 'metropolis') {
      setWidth(String(settings.sampler.width));
      setWarmup(String(settings.sampler.warmup));
    }
  }
  return (
    <details className="settings">
      <summary>Model & sampler settings</summary>
      <form onSubmit={submit} noValidate>
        {model.kind === 'gaussian' && (
          <label htmlFor="coefficient">
            Quadratic coefficient <strong>a</strong>
            <input
              id="coefficient"
              type="number"
              inputMode="decimal"
              min="0.05"
              max="20"
              step="any"
              value={a}
              onChange={(e) => setA(e.target.value)}
            />
            <small>0.05–20 · larger a narrows the density</small>
          </label>
        )}
        {model.kind !== 'binomial' ? (
          <label htmlFor="source">
            {model.kind === 'spin' ? 'Field' : 'Source'} <strong>h</strong>
            <input
              id="source"
              aria-label={model.kind === 'spin' ? 'Field h' : 'Source h'}
              aria-describedby="source-help"
              type="number"
              inputMode="decimal"
              min="-10"
              max="10"
              step="any"
              value={h}
              onChange={(e) => setH(e.target.value)}
            />
            <small id="source-help">−10–10 · dimensionless field</small>
          </label>
        ) : (
          <>
            <label htmlFor="trials">
              Bernoulli count n
              <input
                id="trials"
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                step="1"
                value={n}
                onChange={(e) => setN(e.target.value)}
              />
            </label>
            <label htmlFor="probability">
              Success probability p
              <input
                id="probability"
                type="number"
                inputMode="decimal"
                min="0.001"
                max="0.999"
                step="any"
                value={p}
                onChange={(e) => setP(e.target.value)}
              />
              <small>n: 1–100 · p: 0.001–0.999 (finite log-odds)</small>
            </label>
          </>
        )}
        <label htmlFor="sampler">
          Sampling algorithm
          <select
            id="sampler"
            value={kind}
            onChange={(e) => setKind(e.target.value as Sampler['kind'])}
          >
            <option value="direct">Direct independent</option>
            {model.kind === 'spin' && (
              <option value="heat-bath">Single-spin heat bath</option>
            )}
            <option value="metropolis">Metropolis</option>
          </select>
        </label>
        {kind === 'metropolis' ? (
          <>
            {model.kind === 'gaussian' && (
              <label htmlFor="width">
                Proposal half-width δ
                <input
                  id="width"
                  aria-label="Proposal half-width δ"
                  aria-describedby="width-help"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="50"
                  step="any"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
                <small id="width-help">
                  Uniform displacement in [−δ, δ] · 0.01–50
                </small>
              </label>
            )}
            {model.kind === 'spin' && (
              <p className="settings-warning">
                Lazy symmetric proposal: ½ stay, ½ flip. Aperiodic, including at
                zero field.
              </p>
            )}
            {model.kind === 'binomial' && (
              <p className="settings-warning">
                Symmetric ±1 attempt. Out-of-range attempts become
                self-proposals.
              </p>
            )}
            <label htmlFor="warmup">
              Warm-up updates
              <input
                id="warmup"
                aria-label="Warm-up updates"
                aria-describedby="warmup-help"
                type="number"
                inputMode="numeric"
                min="0"
                max="10000"
                step="1"
                value={warmup}
                onChange={(e) => setWarmup(e.target.value)}
              />
              <small id="warmup-help">
                Discard 0–10000 updates per new segment. This budget does not
                guarantee mixing.
              </small>
            </label>
          </>
        ) : (
          <p className="settings-warning">
            Exact independent draws; no warm-up needed.
            {kind === 'heat-bath' &&
              ' A single-spin heat-bath resample does not depend on its previous value.'}
          </p>
        )}
        <button
          type="submit"
          className="button primary full"
          disabled={disabled}
        >
          Apply settings
        </button>
        <p className="settings-warning">
          Apply keeps compatible history and the RNG stream. Changed model
          parameters or sampler settings start fresh segment statistics.
        </p>
        <button
          type="button"
          className="button full"
          onClick={preset}
          disabled={disabled}
        >
          {model.kind === 'gaussian'
            ? 'Standard Gaussian preset'
            : 'Default model parameters'}
        </button>
        <details className="seed-settings">
          <summary>Reset seed</summary>
          <label htmlFor="seed">
            Seed on Reset
            <input
              id="seed"
              type="number"
              inputMode="numeric"
              min="0"
              max="4294967295"
              step="1"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
          <small>
            Reset or changing model family restarts this seed. Apply preserves
            the stream.
          </small>
        </details>
      </form>
    </details>
  );
}

export function SettingsPanel(
  props: Parameters<typeof ScalarSettingsPanel>[0],
) {
  return props.settings.model.kind === 'scalar' ? (
    <ScalarSettings {...props} />
  ) : props.settings.model.kind === 'ising' ? (
    <GraphSamplerSettings {...props} />
  ) : (
    <ScalarSettingsPanel {...props} />
  );
}
function GraphSamplerSettings({
  settings,
  seed,
  setSeed,
  apply,
  disabled,
}: Parameters<typeof ScalarSettingsPanel>[0]) {
  const [kind, setKind] = useState(settings.sampler.kind),
    [warmup, setWarmup] = useState(
      settings.sampler.kind === 'direct'
        ? '200'
        : String(settings.sampler.warmup ?? 200),
    );
  const appliedSampler = JSON.stringify(settings.sampler);
  useEffect(() => {
    setKind(settings.sampler.kind);
    setWarmup(
      settings.sampler.kind === 'direct'
        ? '200'
        : String(settings.sampler.warmup ?? 200),
    );
  }, [appliedSampler]);
  return (
    <details className="settings">
      <summary>Model & sampler settings</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({
            model: settings.model,
            sampler:
              kind === 'direct'
                ? { kind }
                : kind === 'heat-bath'
                  ? { kind, warmup: warmup.trim() ? Number(warmup) : NaN }
                  : {
                      kind,
                      width: 1,
                      warmup: warmup.trim() ? Number(warmup) : NaN,
                    },
          });
        }}
        noValidate
      >
        <label>
          Sampling algorithm
          <select
            id="sampler"
            value={kind}
            onChange={(e) => setKind(e.target.value as Sampler['kind'])}
          >
            <option value="direct">Direct exact enumeration</option>
            <option value="metropolis">Local lazy Metropolis</option>
            <option value="heat-bath">Local heat bath</option>
          </select>
        </label>
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
          Uniform random site per local update. Metropolis proposes ½ stay, ½
          flip. Heat bath resamples the selected spin conditional on its
          neighbors. N elementary updates = one nominal sweep; not physical
          time. Warm-up is not a mixing guarantee.
        </p>
        <button className="button primary full" disabled={disabled}>
          Apply settings
        </button>
        <details className="seed-settings">
          <summary>Reset seed</summary>
          <label>
            Seed on Reset
            <input
              id="seed"
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
        </details>
        <p className="settings-warning">
          Reset initializes all spins +1, clears history and restarts this seed.
          Direct sampling draws a whole configuration with one uniform and needs
          no warm-up.
        </p>
      </form>
    </details>
  );
}
