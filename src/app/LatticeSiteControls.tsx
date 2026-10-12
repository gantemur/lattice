import type { LatticeSnapshot } from '../engine/latticeRun';

/** A shared, keyboard-accessible selector for either view of the same spin state. */
export function LatticeSiteControls({
  snapshot,
  selected,
  select,
}: {
  snapshot: LatticeSnapshot;
  selected: number;
  select: (site: number) => void;
}) {
  const { lx, ly } = snapshot.configuration.parameters;
  const site = Math.min(snapshot.spins.length - 1, Math.max(0, selected));
  return (
    <div className="lattice-site-controls">
      <label>
        Inspect x{' '}
        <input
          aria-label="Inspect x"
          type="number"
          min="0"
          max={lx - 1}
          value={site % lx}
          onChange={(event) =>
            select(
              Math.min(lx - 1, Math.max(0, Number(event.target.value))) +
                lx * Math.floor(site / lx),
            )
          }
        />
      </label>
      <label>
        y{' '}
        <input
          aria-label="Inspect y"
          type="number"
          min="0"
          max={ly - 1}
          value={Math.floor(site / lx)}
          onChange={(event) =>
            select(
              (site % lx) +
                lx * Math.min(ly - 1, Math.max(0, Number(event.target.value))),
            )
          }
        />
      </label>
      <span>
        Spin <strong>{snapshot.spins[site] === 1 ? '+1' : '−1'}</strong>
      </span>
    </div>
  );
}
