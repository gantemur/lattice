import type { LatticeSnapshot } from '../engine/latticeRun';
import { LatticeSiteControls } from './LatticeSiteControls';
import { latticeNeighborhood } from './neighborhoodCells';

/** A read-only local image of the same physical spin array shown by the canvas. */
export function LatticeNeighborhood({
  snapshot,
  selected,
  select,
}: {
  snapshot: LatticeSnapshot;
  selected: number;
  select: (site: number) => void;
}) {
  const shape = snapshot.configuration.parameters;
  const site = Math.min(snapshot.spins.length - 1, Math.max(0, selected));
  const cells = latticeNeighborhood(shape, snapshot.spins, site);
  return (
    <section
      className="lattice-neighborhood"
      aria-label="Local 5×5 neighborhood"
    >
      <p className="plot-note">
        5×5 neighborhood centered on ({site % shape.lx},{' '}
        {Math.floor(site / shape.lx)}). Selecting a site changes only this view.
      </p>
      <LatticeSiteControls
        snapshot={snapshot}
        selected={site}
        select={select}
      />
      <div
        className="lattice-detail"
        role="group"
        aria-label="Five by five selected-site neighborhood, row by row"
      >
        {cells.map((cell) => (
          <span
            key={`${cell.dx},${cell.dy}`}
            className={`${cell.spin === null ? 'outside' : cell.spin === 1 ? 'plus' : 'minus'}${cell.center ? ' center' : ''}`}
            role="img"
            aria-label={
              cell.site === null
                ? `Offset ${cell.dx}, ${cell.dy}: outside open boundary`
                : `Offset ${cell.dx}, ${cell.dy}: site (${cell.x}, ${cell.y}), spin ${cell.spin === 1 ? 'plus one' : 'minus one'}`
            }
            title={
              cell.site === null
                ? 'Outside open boundary'
                : `(${cell.x},${cell.y}) ${cell.spin}`
            }
            data-testid="neighborhood-cell"
            data-site={cell.site ?? 'outside'}
            data-center={cell.center}
          >
            {cell.spin === null ? '·' : cell.spin === 1 ? '+' : '−'}
          </span>
        ))}
      </div>
      <p className="plot-note">
        Teal +1 · orange −1 · pale outside. Periodic directions wrap, so small
        lattices can show the same physical site more than once.
      </p>
    </section>
  );
}
