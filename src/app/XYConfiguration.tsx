import { useEffect, useRef } from 'react';
import { drawingPositions } from '../domain/graph';
import type { XYModel, XYState } from '../models/xy';
import { wrapXY } from '../models/xy';
import type { XYFaceCharge } from '../models/xyVortices';
import { formatNumber as fmt } from '../plotting/PlotFrame';
export type XYSelection = { site: number; bond: string; face: number };
export function XYSelectors({
  model,
  selection,
  select,
}: {
  model: XYModel;
  selection: XYSelection;
  select: (s: XYSelection) => void;
}) {
  const number = (
    label: string,
    value: number,
    max: number,
    change: (n: number) => void,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min="0"
        max={max}
        step="1"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n >= 0 && n <= max) change(n);
        }}
      />
    </label>
  );
  return (
    <div className="gauge-selectors">
      {number('XY selected site', selection.site, model.size - 1, (site) =>
        select({ ...selection, site }),
      )}
      {model.shape && (
        <>
          {number(
            'XY site x',
            selection.site % model.shape.lx,
            model.shape.lx - 1,
            (x) =>
              select({
                ...selection,
                site:
                  x +
                  model.shape!.lx *
                    Math.floor(selection.site / model.shape!.lx),
              }),
          )}
          {number(
            'XY site y',
            Math.floor(selection.site / model.shape.lx),
            model.shape.ly - 1,
            (y) =>
              select({
                ...selection,
                site: (selection.site % model.shape!.lx) + model.shape!.lx * y,
              }),
          )}
        </>
      )}
      {model.bonds.length > 0 && (
        <label>
          XY selected bond
          <select
            value={selection.bond}
            onChange={(e) => select({ ...selection, bond: e.target.value })}
          >
            {model.bonds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id}: {b.tail} → {b.head}
                {b.wraps ? ' · wrap' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {model.faces.length > 0 &&
        number(
          'XY selected plaquette',
          selection.face,
          model.faces.length - 1,
          (face) => select({ ...selection, face }),
        )}
    </div>
  );
}
export function XYConfigurationView({
  model,
  angles,
  selection,
  select,
  charges,
  overlay,
  setOverlay,
  preview = false,
}: {
  model: XYModel;
  angles: XYState;
  selection: XYSelection;
  select: (s: XYSelection) => void;
  charges: XYFaceCharge[];
  overlay: boolean;
  setOverlay: (v: boolean) => void;
  preview?: boolean;
}) {
  const edge = model.bonds.find((b) => b.id === selection.bond);
  return (
    <div className="xy-configuration">
      <p>
        {model.size} continuous site spins · {model.bonds.length} physical bonds
        · {model.faces.length} oriented plaquettes
        {preview ? ' · rotation preview only' : ''}
      </p>
      {model.graph ? (
        <XYGraph {...{ model, angles, selection, select }} />
      ) : (
        <XYCanvas {...{ model, angles, selection, select, charges, overlay }} />
      )}
      <p className="plot-note">
        Arrows are (cos θ, sin θ); radians in [−π,π). Screen rows increase
        downward; mathematical +y and counterclockwise spin directions point
        upward. Color is an additional angle cue.
      </p>
      {model.faces.length > 0 && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            Show XY vortex overlay
          </label>
          {overlay && model.size <= 4 && (
            <div className="xy-face-strip" aria-label="XY plaquette charges">
              {charges.map((f, i) => (
                <button
                  key={f.id}
                  className={selection.face === i ? 'selected' : ''}
                  onClick={() => select({ ...selection, face: i })}
                  aria-label={`Select XY plaquette ${f.id}, ${f.status === 'valid' ? `charge ${f.charge}` : f.status}`}
                >
                  {f.id}:{' '}
                  {f.charge === null
                    ? '?'
                    : f.charge > 0
                      ? `+${f.charge}`
                      : f.charge}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <XYSelectors {...{ model, selection, select }} />
      <p data-testid="xy-selected">
        Site {selection.site}: θ={fmt(angles[selection.site]!)} rad; spin=(
        {fmt(Math.cos(angles[selection.site]!))},{' '}
        {fmt(Math.sin(angles[selection.site]!))}).
      </p>
      <p data-testid="xy-bond">
        {edge
          ? `Bond ${edge.id}: ${edge.tail} → ${edge.head}${edge.wraps ? ' wrap' : ''}; K=${edge.K}; principal Δθ=${fmt(wrapXY(angles[edge.head]! - angles[edge.tail]!))}; cosine=${fmt(Math.cos(angles[edge.head]! - angles[edge.tail]!))}; S contribution=${fmt(-edge.K * Math.cos(angles[edge.head]! - angles[edge.tail]!))}.`
          : 'No physical bond on this site.'}
      </p>
      {model.shape && (
        <p>
          {model.shape.lx}×{model.shape.ly}; x{' '}
          {model.shape.periodicX ? 'periodic' : 'open'}, y{' '}
          {model.shape.periodicY ? 'periodic' : 'open'}. Open boundaries omit
          bonds.
        </p>
      )}
    </div>
  );
}
function XYGraph({
  model,
  angles,
  selection,
  select,
}: {
  model: XYModel;
  angles: XYState;
  selection: XYSelection;
  select: (s: XYSelection) => void;
}) {
  const positions = drawingPositions(model.graph!);
  return (
    <svg
      className="graph-diagram"
      viewBox="0 0 360 260"
      role="group"
      aria-label="XY planar spin graph"
    >
      {model.bonds.map((b) => {
        const [x1, y1] = positions[model.siteIds[b.tail]!]!,
          [x2, y2] = positions[model.siteIds[b.head]!]!;
        const parallels = model.bonds.filter(
          (e) =>
            (e.tail === b.tail && e.head === b.head) ||
            (e.head === b.tail && e.tail === b.head),
        );
        const offset =
            (parallels.findIndex((e) => e.id === b.id) -
              (parallels.length - 1) / 2) *
            60,
          sign = b.tail < b.head ? 1 : -1;
        const length = Math.hypot(x2 - x1, y2 - y1) || 1,
          cx = (x1 + x2) / 2 - ((y2 - y1) / length) * offset * sign,
          cy = (y1 + y2) / 2 + ((x2 - x1) / length) * offset * sign;
        return (
          <g
            key={b.id}
            role="button"
            tabIndex={0}
            aria-label={`Select XY bond ${b.id}`}
            onClick={() => select({ ...selection, bond: b.id })}
            onKeyDown={(e) => {
              if (['Enter', ' '].includes(e.key)) {
                e.preventDefault();
                select({ ...selection, bond: b.id });
              }
            }}
          >
            <path
              d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`}
              fill="none"
              stroke={b.K < 0 ? '#b95b3e' : '#166c67'}
              strokeWidth={selection.bond === b.id ? 4 : 2}
              opacity={b.K === 0 ? 0.4 : 1}
              strokeDasharray={b.wraps ? '6 4' : undefined}
            />
            <text
              x={(x1 + 2 * cx + x2) / 4}
              y={(y1 + 2 * cy + y2) / 4 - 6}
              textAnchor="middle"
              fontSize="12"
            >
              {b.id}
            </text>
          </g>
        );
      })}
      {model.siteIds.map((id, i) => {
        const [x, y] = positions[id]!,
          a = angles[i]!,
          dx = 18 * Math.cos(a),
          dy = -18 * Math.sin(a);
        return (
          <g
            key={id}
            role="button"
            tabIndex={0}
            aria-label={`Select XY site ${i}`}
            onClick={() => select({ ...selection, site: i })}
            onKeyDown={(e) => {
              if (['Enter', ' '].includes(e.key)) {
                e.preventDefault();
                select({ ...selection, site: i });
              }
            }}
          >
            <circle
              cx={x}
              cy={y}
              r="25"
              fill="#f5f2e9"
              stroke={selection.site === i ? '#c79816' : '#166c67'}
              strokeWidth={selection.site === i ? 4 : 2}
            />
            <path
              d={`M${x - dx * 0.5} ${y - dy * 0.5} L${x + dx} ${y + dy} M${x + dx * 0.5 - dy * 0.3} ${y + dy * 0.5 + dx * 0.3} L${x + dx} ${y + dy} L${x + dx * 0.5 + dy * 0.3} ${y + dy * 0.5 - dx * 0.3}`}
              stroke="#166c67"
              strokeWidth="2.5"
              fill="none"
            />
            <text x={x} y={y + 40} textAnchor="middle" fontSize="12">
              {i}: {fmt(a)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
function XYCanvas({
  model,
  angles,
  selection,
  select,
  charges,
  overlay,
}: {
  model: XYModel;
  angles: XYState;
  selection: XYSelection;
  select: (s: XYSelection) => void;
  charges: XYFaceCharge[];
  overlay: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    { lx, ly } = model.shape!;
  useEffect(() => {
    const canvas = ref.current!,
      ctx = canvas.getContext('2d')!,
      cell = Math.floor(640 / Math.max(lx, ly)),
      margin = cell / 2;
    canvas.width = (lx + 1) * cell;
    canvas.height = (ly + 1) * cell;
    ctx.fillStyle = '#f5f2e9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < angles.length; i++) {
      const x = margin + ((i % lx) + 0.5) * cell,
        y = margin + (Math.floor(i / lx) + 0.5) * cell,
        a = angles[i]!,
        length = cell * 0.35;
      ctx.fillStyle = `hsl(${((a + Math.PI) / (2 * Math.PI)) * 360} 42% 85%)`;
      ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell);
      const dx = length * Math.cos(a),
        dy = -length * Math.sin(a);
      ctx.strokeStyle = '#203b38';
      ctx.lineWidth = Math.max(1, cell / 18);
      ctx.beginPath();
      ctx.moveTo(x - dx * 0.5, y - dy * 0.5);
      ctx.lineTo(x + dx, y + dy);
      ctx.moveTo(x + dx * 0.5 - dy * 0.35, y + dy * 0.5 + dx * 0.35);
      ctx.lineTo(x + dx, y + dy);
      ctx.lineTo(x + dx * 0.5 + dy * 0.35, y + dy * 0.5 - dx * 0.35);
      ctx.stroke();
    }
    ctx.strokeStyle = '#b95b3e';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      margin + (selection.site % lx) * cell,
      margin + Math.floor(selection.site / lx) * cell,
      cell,
      cell,
    );
    if (overlay)
      model.faces.forEach((f, i) => {
        const charge = charges[i];
        if (!charge) return;
        if (charge.charge === 0 && selection.face !== i) return;
        // Wrap faces occupy their own margin seam, rather than being collapsed
        // onto the interior square on a length-two torus.
        const x = margin + (f.x! + 1) * cell,
          y = margin + (f.y! + 1) * cell;
        ctx.fillStyle =
          charge.charge === null
            ? '#6554a4'
            : charge.charge > 0
              ? '#b95b3e'
              : '#166c67';
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.23, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(10, cell * 0.36)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          charge.charge === null
            ? '?'
            : charge.charge > 0
              ? '+'
              : charge.charge < 0
                ? '−'
                : '0',
          x,
          y,
        );
      });
  }, [angles, model, lx, ly, selection.site, selection.face, overlay, charges]);
  return (
    <canvas
      ref={ref}
      data-testid="xy-canvas"
      aria-label={`${lx} by ${ly} XY spin arrows; use site and plaquette selectors`}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect(),
          x = Math.max(
            0,
            Math.min(
              lx - 1,
              Math.floor(
                ((e.clientX - rect.left) / rect.width) * (lx + 1) - 0.5,
              ),
            ),
          ),
          y = Math.max(
            0,
            Math.min(
              ly - 1,
              Math.floor(
                ((e.clientY - rect.top) / rect.height) * (ly + 1) - 0.5,
              ),
            ),
          );
        select({ ...selection, site: x + lx * y });
      }}
    />
  );
}
