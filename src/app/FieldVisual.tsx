import type { FieldShape } from '../domain/fieldLattice';
import { formatNumber } from '../plotting/PlotFrame';

function cellColor(value: number, limit: number) {
  const fraction = Math.min(1, Math.abs(value) / limit);
  // Negative teal and positive ochre match the existing Lattice Lab palette.
  return value < 0
    ? `hsl(174 55% ${96 - 58 * fraction}%)`
    : `hsl(28 73% ${96 - 45 * fraction}%)`;
}

export function FieldVisual({
  shape,
  field,
  selected,
  onSelect,
  limit,
}: {
  shape: FieldShape;
  field: number[] | null;
  selected: number;
  onSelect: (site: number) => void;
  limit: number;
}) {
  const values =
    field ??
    Array<number>(
      shape.kind === 'chain' ? shape.length : shape.lx * shape.ly,
    ).fill(0);
  const clipped = values.filter((value) => Math.abs(value) > limit).length;
  if (shape.kind === 'chain') {
    const x = (site: number) => 38 + (524 * site) / (values.length - 1);
    const y = (value: number) =>
      112 - 86 * Math.max(-1, Math.min(1, value / limit));
    const points = values
      .map((value, site) => `${x(site)},${y(value)}`)
      .join(' ');
    return (
      <section
        className="field-visual"
        aria-label="One-dimensional field profile"
      >
        <h2>Field profile</h2>
        <svg
          viewBox="0 0 600 225"
          role="img"
          aria-label={`One-dimensional field values, displayed from minus ${limit} to plus ${limit}`}
        >
          <line x1="38" y1="112" x2="562" y2="112" stroke="#aabbb4" />
          <line x1="38" y1="26" x2="562" y2="26" stroke="#e2e5de" />
          <line x1="38" y1="198" x2="562" y2="198" stroke="#e2e5de" />
          <text x="2" y="30" fontSize="12">
            +{limit}
          </text>
          <text x="2" y="116" fontSize="12">
            0
          </text>
          <text x="2" y="202" fontSize="12">
            −{limit}
          </text>
          <polyline
            points={points}
            fill="none"
            stroke="#14625a"
            strokeWidth="2.5"
          />
          {values.map((value, site) => (
            <circle
              key={site}
              cx={x(site)}
              cy={y(value)}
              r={site === selected ? 6 : 3.5}
              fill={site === selected ? '#a25721' : '#14625a'}
            >
              <title>{`Site ${site}: ${formatNumber(value)}`}</title>
            </circle>
          ))}
          <text x="36" y="219" fontSize="12">
            site 0
          </text>
          <text x="517" y="219" fontSize="12">
            site {values.length - 1}
          </text>
        </svg>
        <p className="plot-note">
          Fixed display range ±{limit}; {clipped} value
          {clipped === 1 ? '' : 's'} clipped. Use the site selector to inspect
          any coordinate. The horizontal axis is a lattice coordinate, not time.
        </p>
      </section>
    );
  }
  return (
    <section
      className="field-visual"
      aria-label="Two-dimensional field heatmap"
    >
      <h2>Field heatmap</h2>
      <div
        className="field-heatmap"
        style={{ gridTemplateColumns: `repeat(${shape.lx}, minmax(0, 1fr))` }}
      >
        {values.map((value, site) => (
          <button
            key={site}
            type="button"
            className={site === selected ? 'field-cell selected' : 'field-cell'}
            style={{ background: cellColor(value, limit) }}
            onClick={() => onSelect(site)}
            aria-label={`Select site x ${site % shape.lx}, y ${Math.floor(site / shape.lx)}; value ${formatNumber(value)}${Math.abs(value) > limit ? '; clipped by display scale' : ''}`}
            aria-pressed={site === selected}
          >
            {shape.lx <= 4 ? formatNumber(value) : ''}
          </button>
        ))}
      </div>
      <div
        className="field-scale"
        aria-label={`Color scale from minus ${limit} through zero to plus ${limit}`}
      >
        <span>−{limit}</span>
        <i />
        <span>0</span>
        <i className="positive" />
        <span>+{limit}</span>
      </div>
      <p className="plot-note">
        Controlled color range ±{limit}; {clipped} value
        {clipped === 1 ? '' : 's'} clipped. Dark outline marks the selected
        site. Open edges omit wrap bonds; no boundary values are fixed to zero.
      </p>
    </section>
  );
}
