import type { LatticeSnapshot } from '../engine/latticeRun';

/** A real one-dimensional drawing. For N>17 the selected site anchors a
 * movable local window; the numeric control reaches every site. */
export function SpinChain({
  snapshot,
  selected,
  select,
}: {
  snapshot: LatticeSnapshot;
  selected: number;
  select: (site: number) => void;
}) {
  const n = snapshot.spins.length;
  const periodic = snapshot.configuration.parameters.periodicX;
  const first = n <= 17 ? 0 : Math.max(0, Math.min(n - 17, selected - 8));
  const last = Math.min(n, first + 17);
  const sites = Array.from({ length: last - first }, (_, i) => first + i);
  const x = (site: number) =>
    34 + (site - first) * (572 / Math.max(1, sites.length - 1));
  return (
    <section className="spin-chain" aria-label="Spin chain configuration">
      <p className="plot-note">
        {periodic
          ? n > 17
            ? 'Periodic ring · closing bond outside this local window'
            : 'Periodic ring · closing bond shown above'
          : 'Open chain · free ends'}{' '}
        · {n} spins · {n > 17 ? `window ${first}–${last - 1}` : 'whole chain'}
      </p>
      <svg
        viewBox="0 0 640 150"
        role="img"
        aria-label={`${n}-site ${periodic ? 'periodic' : 'open'} Ising spin chain`}
      >
        {sites.slice(1).map((site) => (
          <line
            key={`bond-${site}`}
            x1={x(site - 1)}
            y1="75"
            x2={x(site)}
            y2="75"
            stroke="#8ca9a0"
            strokeWidth="3"
          />
        ))}
        {periodic && first === 0 && last === n && (
          <path
            d={`M ${x(0)} 66 Q 320 -14 ${x(n - 1)} 66`}
            fill="none"
            stroke="#cdbb83"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}
        {sites.map((site) => (
          <g
            key={site}
            role="button"
            tabIndex={0}
            aria-label={`Select chain site ${site}, spin ${snapshot.spins[site] === 1 ? 'plus' : 'minus'}`}
            onClick={() => select(site)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select(site);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={x(site)}
              cy="75"
              r="15"
              fill={snapshot.spins[site] === 1 ? '#14625a' : '#c87d44'}
              stroke={
                site === selected
                  ? '#f5ce66'
                  : site === snapshot.lastTrace?.site
                    ? '#fff3bb'
                    : '#29423d'
              }
              strokeWidth={
                site === selected || site === snapshot.lastTrace?.site ? 4 : 2
              }
            />
            <text
              x={x(site)}
              y="80"
              textAnchor="middle"
              fill="white"
              fontSize="15"
            >
              {snapshot.spins[site] === 1 ? '+' : '−'}
            </text>
            <text
              x={x(site)}
              y="113"
              textAnchor="middle"
              fill="#d2dfd5"
              fontSize="11"
            >
              {site}
            </text>
          </g>
        ))}
      </svg>
      <div className="lattice-site-controls">
        <label>
          Inspect site{' '}
          <input
            aria-label="Inspect chain site"
            type="number"
            min="0"
            max={n - 1}
            value={selected}
            onChange={(e) =>
              select(Math.max(0, Math.min(n - 1, Number(e.target.value))))
            }
          />
        </label>
        <span>
          Selected s<sub>{selected}</sub> ={' '}
          {snapshot.spins[selected] === 1 ? '+1' : '−1'}
        </span>
        <span>Latest updated site: {snapshot.lastTrace?.site ?? '—'}</span>
      </div>
    </section>
  );
}
