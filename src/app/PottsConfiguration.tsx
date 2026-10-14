import { useEffect, useRef } from 'react';
import type { PottsModel } from '../models/potts';
import type { FKComponents } from '../models/fk';
import type { PottsSnapshot } from '../engine/pottsRun';
import { drawingPositions } from '../domain/graph';
// A deterministic display palette, never sampled colors or an RNG stream.
export const clusterColor = (label: number) =>
  `hsl(${(label * 137.508 + 170) % 360} 55% 37%)`;
export const pottsColors = ['#166c67', '#b95b3e', '#6554a4', '#c79816'];
/** Categorical color labels are accessible independently of the palette. This
 * projection never maps a color to an angle or reuses Ising spin arithmetic. */
export function PottsConfigurationView({
  model,
  snapshot,
  site,
  bond,
  selectSite,
  selectBond,
  clusters,
  flags,
}: {
  model: PottsModel;
  snapshot: PottsSnapshot | null;
  site: number;
  bond: string;
  selectSite: (site: number) => void;
  selectBond: (id: string) => void;
  clusters?: FKComponents;
  flags?: Uint8Array;
}) {
  const colors = snapshot?.colors ?? new Uint8Array(model.size);
  return (
    <div className="potts-configuration">
      <p>
        {model.size} categorical sites · {model.bonds.length} physical bonds
        {model.graph ? ` · ${model.graph.faces.length} oriented faces` : ''}
      </p>
      {model.graph ? (
        <PottsGraph
          model={model}
          colors={colors}
          site={site}
          bond={bond}
          selectSite={selectSite}
          selectBond={selectBond}
          clusters={clusters}
          flags={flags}
        />
      ) : (
        <PottsCanvas
          model={model}
          colors={colors}
          site={site}
          selectSite={selectSite}
          clusters={clusters}
        />
      )}
      {clusters ? (
        <p>
          Cluster labels c0…c{clusters.count - 1}; hue identifies components,
          not spin colors.
        </p>
      ) : (
        <div className="lattice-legend">
          {Array.from({ length: model.q }, (_, c) => (
            <span key={c}>
              <i style={{ background: pottsColors[c] }} />
              Color {c}
              {c === 0 ? ' · distinguished color' : ''}
            </span>
          ))}
        </div>
      )}
      <div className="gauge-selectors">
        <label>
          Potts selected site
          <input
            type="number"
            min="0"
            max={model.size - 1}
            step="1"
            value={site}
            onChange={(e) => {
              const i = Number(e.target.value);
              if (Number.isInteger(i) && i >= 0 && i < model.size)
                selectSite(i);
            }}
          />
        </label>
        {model.bonds.length > 0 ? (
          <label>
            Potts selected bond
            <select value={bond} onChange={(e) => selectBond(e.target.value)}>
              {model.bonds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id}: {b.tail} → {b.head}
                  {b.wraps ? ' · wrap' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>No bonds on the single site.</p>
        )}
      </div>
      <p data-testid="potts-selected">
        Site {site}, color {colors[site]}; labels are categorical, not angles.
      </p>
      {model.shape && (
        <p className="plot-note">
          {model.shape.lx}×{model.shape.ly}; x{' '}
          {model.shape.periodicX ? 'periodic' : 'open'}, y{' '}
          {model.shape.periodicY ? 'periodic' : 'open'}. Open edges omit bonds,
          without fixing boundary colors. Numeric site selection works even for
          small pixels.
        </p>
      )}
    </div>
  );
}
function PottsGraph({
  model,
  colors,
  site,
  bond,
  selectSite,
  selectBond,
  clusters,
  flags,
}: {
  model: PottsModel;
  colors: Uint8Array;
  site: number;
  bond: string;
  selectSite: (site: number) => void;
  selectBond: (id: string) => void;
  clusters?: FKComponents;
  flags?: Uint8Array;
}) {
  const positions = drawingPositions(model.graph!);
  return (
    <svg
      className="graph-diagram"
      viewBox="0 0 360 260"
      role="group"
      aria-label={clusters ? 'FK component graph' : 'Categorical Potts graph'}
    >
      {model.bonds.map((b, e) => {
        const [x1, y1] = positions[model.siteIds[b.tail]!]!,
          [x2, y2] = positions[model.siteIds[b.head]!]!;
        const parallels = model.bonds.filter(
            (e) =>
              (e.tail === b.tail && e.head === b.head) ||
              (e.tail === b.head && e.head === b.tail),
          ),
          rank = parallels.findIndex((e) => e.id === b.id);
        const offset = (rank - (parallels.length - 1) / 2) * 60,
          sign = b.tail < b.head ? 1 : -1,
          dx = x2! - x1!,
          dy = y2! - y1!,
          length = Math.hypot(dx, dy) || 1;
        const cx = (x1! + x2!) / 2 - (dy / length) * offset * sign,
          cy = (y1! + y2!) / 2 + (dx / length) * offset * sign;
        const lx = (x1! + 2 * cx + x2!) / 4,
          ly = (y1! + 2 * cy + y2!) / 4;
        return (
          <g
            key={b.id}
            role="button"
            tabIndex={0}
            aria-label={`Select Potts bond ${b.id}${b.wraps ? ' wrap' : ''}`}
            onClick={() => selectBond(b.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectBond(b.id);
              }
            }}
          >
            <path
              d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`}
              fill="none"
              stroke={
                flags
                  ? flags[e]
                    ? '#166c67'
                    : '#879997'
                  : b.K < 0
                    ? '#b95b3e'
                    : '#166c67'
              }
              strokeWidth={bond === b.id ? 4 : 2}
              opacity={flags ? (flags[e] ? 1 : 0.3) : b.K === 0 ? 0.45 : 1}
              strokeDasharray={
                flags && !flags[e] ? '2 4' : b.wraps ? '6 4' : undefined
              }
            />
            <rect
              x={lx - 23}
              y={ly - 20}
              width="46"
              height="30"
              fill="transparent"
            />
            <text
              x={lx}
              y={ly - 5}
              textAnchor="middle"
              fontSize="12"
              pointerEvents="none"
            >
              {b.id}
            </text>
          </g>
        );
      })}
      {model.siteIds.map((id, i) => {
        const [x, y] = positions[id]!;
        return (
          <g
            key={id}
            role="button"
            tabIndex={0}
            aria-label={`Select Potts site ${i}, color ${colors[i]}`}
            onClick={() => selectSite(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectSite(i);
              }
            }}
          >
            <circle
              cx={x}
              cy={y}
              r="23"
              fill={
                clusters
                  ? clusterColor(clusters.labels[i]!)
                  : pottsColors[colors[i]!]
              }
              stroke={site === i ? '#e7b64b' : '#203b38'}
              strokeWidth={site === i ? 5 : 2}
            />
            <text
              x={x}
              y={y! + 4}
              textAnchor="middle"
              style={{
                fill: !clusters && colors[i] === 3 ? '#203b38' : 'white',
              }}
              fontSize="13"
            >
              {i}: {clusters ? `c${clusters.labels[i]}` : colors[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
function PottsCanvas({
  model,
  colors,
  site,
  selectSite,
  clusters,
}: {
  model: PottsModel;
  colors: Uint8Array;
  site: number;
  selectSite: (site: number) => void;
  clusters?: FKComponents;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    { lx, ly } = model.shape!;
  useEffect(() => {
    const canvas = ref.current!,
      context = canvas.getContext('2d')!,
      cell = Math.floor(640 / Math.max(lx, ly));
    canvas.width = lx * cell;
    canvas.height = ly * cell;
    for (let i = 0; i < colors.length; i++) {
      context.fillStyle = clusters
        ? clusterColor(clusters.labels[i]!)
        : pottsColors[colors[i]!]!;
      context.fillRect((i % lx) * cell, Math.floor(i / lx) * cell, cell, cell);
    }
    context.strokeStyle = '#f5ce66';
    context.lineWidth = Math.max(2, cell / 8);
    context.strokeRect(
      (site % lx) * cell + 2,
      Math.floor(site / lx) * cell + 2,
      cell - 4,
      cell - 4,
    );
  }, [colors, clusters, site, lx, ly]);
  return (
    <canvas
      ref={ref}
      data-testid="potts-canvas"
      aria-label={`${lx} by ${ly} ${clusters ? 'FK component' : 'categorical Potts'} grid; use numeric site selection`}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect(),
          x = Math.max(
            0,
            Math.min(lx - 1, Math.floor(((e.clientX - r.left) / r.width) * lx)),
          ),
          y = Math.max(
            0,
            Math.min(ly - 1, Math.floor(((e.clientY - r.top) / r.height) * ly)),
          );
        selectSite(x + lx * y);
      }}
    />
  );
}
