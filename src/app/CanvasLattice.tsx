import { useEffect, useRef } from 'react';
import type { LatticeSnapshot } from '../engine/latticeRun';

/** Draws one current spin image. Selection is presentation state; it never posts an update. */
export function CanvasLattice({
  snapshot,
  selected,
  select,
}: {
  snapshot: LatticeSnapshot;
  selected: number;
  select: (site: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { lx, ly, periodicX, periodicY } = snapshot.configuration.parameters;
  useEffect(() => {
    const element = canvas.current!,
      context = element.getContext('2d')!;
    const cell = Math.max(6, Math.floor(640 / Math.max(lx, ly)));
    element.width = lx * cell;
    element.height = ly * cell;
    context.fillStyle = '#14625a';
    context.fillRect(0, 0, element.width, element.height);
    for (let i = 0; i < snapshot.spins.length; i++) {
      context.fillStyle = snapshot.spins[i] === 1 ? '#14625a' : '#c87d44';
      context.fillRect((i % lx) * cell, Math.floor(i / lx) * cell, cell, cell);
    }
    if (cell >= 12) {
      context.strokeStyle = 'rgba(255,255,255,.17)';
      context.lineWidth = 1;
      for (let x = 1; x < lx; x++) {
        context.beginPath();
        context.moveTo(x * cell, 0);
        context.lineTo(x * cell, element.height);
        context.stroke();
      }
      for (let y = 1; y < ly; y++) {
        context.beginPath();
        context.moveTo(0, y * cell);
        context.lineTo(element.width, y * cell);
        context.stroke();
      }
    }
    const mark = (site: number, color: string, width: number) => {
      if (site < 0) return;
      context.strokeStyle = color;
      context.lineWidth = width;
      context.strokeRect(
        (site % lx) * cell + width / 2,
        Math.floor(site / lx) * cell + width / 2,
        cell - width,
        cell - width,
      );
    };
    mark(selected, '#152e2a', Math.max(2, cell / 7));
    if (snapshot.lastTrace)
      mark(snapshot.lastTrace.site, '#f5ce66', Math.max(2, cell / 9));
  }, [snapshot, selected, lx, ly]);
  const site = Math.min(snapshot.spins.length - 1, Math.max(0, selected));
  return (
    <section className="lattice-canvas-card" aria-label="Spin configuration">
      <div className="section-heading">
        <span className="plot-note">Selected site and current spin image</span>
        <span className="parameter-chip">
          {lx}×{ly} · {snapshot.spins.length} sites
        </span>
      </div>
      <canvas
        ref={canvas}
        data-testid="lattice-canvas"
        aria-label={`${lx} by ${ly} Ising spin grid; select a site by pointer or use the site controls`}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.min(
            lx - 1,
            Math.max(
              0,
              Math.floor(((event.clientX - rect.left) / rect.width) * lx),
            ),
          );
          const y = Math.min(
            ly - 1,
            Math.max(
              0,
              Math.floor(((event.clientY - rect.top) / rect.height) * ly),
            ),
          );
          select(x + lx * y);
        }}
      />
      <div className="lattice-legend">
        <span>
          <i className="spin-plus" />
          +1 spin
        </span>
        <span>
          <i className="spin-minus" />
          −1 spin
        </span>
        <span>
          <i className="spin-latest" />
          latest updated site
        </span>
      </div>
      <p className="plot-note">
        The flat image identifies opposite{' '}
        {periodicX && periodicY
          ? 'x and y'
          : periodicX
            ? 'x'
            : periodicY
              ? 'y'
              : 'no'}{' '}
        edges{periodicX || periodicY ? ' periodically' : ''}. Pixel position
        selects lattice coordinates; selection does not change spins.
      </p>
      <div className="lattice-site-controls">
        <label>
          Inspect x{' '}
          <input
            aria-label="Inspect x"
            type="number"
            min="0"
            max={lx - 1}
            value={site % lx}
            onChange={(e) =>
              select(
                Math.min(lx - 1, Math.max(0, Number(e.target.value))) +
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
            onChange={(e) =>
              select(
                (site % lx) +
                  lx * Math.min(ly - 1, Math.max(0, Number(e.target.value))),
              )
            }
          />
        </label>
        <span>
          Spin <strong>{snapshot.spins[site] === 1 ? '+1' : '−1'}</strong>
        </span>
      </div>
      <div className="lattice-detail" aria-label="Selected site neighborhood">
        {Array.from({ length: 25 }, (_, i) => {
          const dx = (i % 5) - 2,
            dy = Math.floor(i / 5) - 2,
            x = (site % lx) + dx,
            y = Math.floor(site / lx) + dy;
          const inBounds =
            (periodicX || (x >= 0 && x < lx)) &&
            (periodicY || (y >= 0 && y < ly));
          const at = ((x + lx) % lx) + lx * ((y + ly) % ly);
          return (
            <span
              key={i}
              className={`${inBounds ? (snapshot.spins[at] === 1 ? 'plus' : 'minus') : 'outside'} ${i === 12 ? 'center' : ''}`}
              title={
                inBounds
                  ? `(${(x + lx) % lx},${(y + ly) % ly}) ${snapshot.spins[at]}`
                  : 'Outside open boundary'
              }
            >
              {inBounds ? (snapshot.spins[at] === 1 ? '+' : '−') : ''}
            </span>
          );
        })}
      </div>
      <small>
        5×5 detail centered on ({site % lx}, {Math.floor(site / lx)}); periodic
        directions wrap.
      </small>
    </section>
  );
}
