import type { FieldSegmentSnapshot } from '../engine/fieldRun';
import {
  createFourierBasis,
  fieldEigenvalues,
  isFullyPeriodic,
} from '../models/fieldFourier';
import { sampledModePower } from '../observables/fieldSpectrum';
import { formatNumber } from '../plotting/PlotFrame';

/** Momentum selection is owned by the keyed tool assignment, so a feature swap
 * may remount this renderer without losing the selected mode. */
export function FieldSpectrum({
  segment,
  selected,
  onSelect,
}: {
  segment: FieldSegmentSnapshot;
  selected: number;
  onSelect: (mode: number) => void;
}) {
  // Only the Gaussian workspace offers this Fourier reference tool.
  const p = segment.settings.parameters;
  const reference = segment.reference!;
  if (!isFullyPeriodic(p.shape))
    return (
      <section className="field-results" aria-label="Fourier spectrum">
        <h2>Fourier spectrum</h2>
        <p>
          Full periodicity is required for these momentum eigenmodes. Open and
          mixed boundaries retain the dense finite-volume reference.
        </p>
      </section>
    );
  const basis = createFourierBasis(p.shape);
  const eigenvalues = reference.eigenvalues ?? fieldEigenvalues(p, basis);
  const mode = Math.min(selected, basis.size - 1);
  const removed = reference.measure === 'mean-zero' && mode === 0;
  const exact = removed ? null : 1 / eigenvalues[mode]!;
  const measured =
    segment.measurements > 0 && !removed
      ? sampledModePower(
          basis,
          mode,
          segment.pairProducts,
          segment.sites.map((s) => s.mean!),
          reference.mean,
        )
      : null;
  const maxPower = Math.max(
    1,
    ...eigenvalues
      .slice(removed ? 1 : 0)
      .filter((value) => value > 0)
      .map((value) => 1 / value),
  );
  return (
    <section className="field-results" aria-label="Fourier spectrum">
      <h2>Finite-volume Fourier spectrum</h2>
      <p className="plot-note">
        Momentum k=(kx,ky) uses row-major mode kx+Lx·ky. Colors show exact mode
        power 1/λ(k), from pale (0) to dark ({formatNumber(maxPower)} field²).
        Select a mode for its full-segment comparison.
      </p>
      <label className="field-spectrum-mode">
        Select momentum index (0–{basis.size - 1})
        <input
          aria-label="Fourier momentum index"
          type="number"
          min="0"
          max={basis.size - 1}
          step="1"
          value={mode}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isInteger(value) && value >= 0 && value < basis.size)
              onSelect(value);
          }}
        />
      </label>
      <div
        className={
          basis.ly === 1
            ? 'field-spectrum-grid field-spectrum-bars'
            : 'field-spectrum-grid field-spectrum-map'
        }
        style={{ gridTemplateColumns: `repeat(${basis.lx}, minmax(0, 1fr))` }}
      >
        {eigenvalues.map((lambda, index) => {
          const isRemoved = reference.measure === 'mean-zero' && index === 0;
          const power = isRemoved ? 0 : 1 / lambda;
          const shade = Math.min(1, power / maxPower);
          return (
            <button
              key={index}
              type="button"
              className="field-spectrum-cell"
              aria-pressed={mode === index}
              aria-label={`Select momentum kx ${index % basis.lx}, ky ${Math.floor(index / basis.lx)}${isRemoved ? ', removed zero mode' : `, exact power ${formatNumber(power)}`}`}
              onClick={() => onSelect(index)}
              style={{
                backgroundColor: isRemoved
                  ? '#e5e8e3'
                  : `hsl(174 50% ${95 - 56 * shade}%)`,
                ...(basis.ly === 1
                  ? { height: `${Math.max(12, 12 + 94 * shade)}px` }
                  : {}),
              }}
            >
              {basis.ly === 1
                ? index
                : `${index % basis.lx},${Math.floor(index / basis.lx)}`}
              {isRemoved ? ' ×' : ''}
            </button>
          );
        })}
      </div>
      <p className="plot-note">
        {basis.ly === 1
          ? 'Horizontal axis: momentum index kx; bar height: exact finite-volume mode power in field².'
          : 'Momentum grid: horizontal kx, vertical ky; color: exact finite-volume mode power in field².'}
      </p>
      <p>
        Selected k=({mode % basis.lx},{Math.floor(mode / basis.lx)}): λ(k)=
        {formatNumber(eigenvalues[mode]!)}; exact power{' '}
        {removed ? 'removed zero mode' : formatNumber(exact)}; sampled
        full-segment power{' '}
        {removed ? 'N/A (constrained)' : formatNumber(measured)}.
      </p>
      <p className="plot-note">
        Forward F(k)=Σx φ(x)e<sup>−ik·x</sup>; power is E[|F(φ−μ)|²]/N in
        field². Segment total: {segment.updates} updates; {segment.measurements}{' '}
        retained measurements; {segment.recent.length} recent vectors still
        displayed; {segment.discardedMeasurements} older vectors evicted.
        Sampled power uses all segment measurements, with no uncertainty
        correction.
      </p>
    </section>
  );
}
