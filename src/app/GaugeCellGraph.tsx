import { useId } from 'react';
import type { gaugeGeometry } from '../domain/gaugeGeometry';

/** Geometry is drawn separately from physical edge identity. In particular,
 * dashed arcs are independent periodic links, not decorative copies. */
export function GaugeCellGraph({
  model,
  linkLabels,
  linkDetails,
  linkColors,
  faceLabels,
  groupLabel,
  note,
  edge,
  vertex,
  face,
  loop,
  selectEdge,
  selectVertex,
  selectFace,
}: {
  model: Pick<
    ReturnType<typeof gaugeGeometry>,
    'geometry' | 'domain' | 'loops'
  >;
  linkLabels: string[];
  linkDetails?: string[];
  linkColors: string[];
  faceLabels: string[];
  groupLabel: string;
  note: string;
  edge: string;
  vertex: string;
  face: string;
  loop: string;
  selectEdge: (id: string) => void;
  selectVertex: (id: string) => void;
  selectFace: (id: string) => void;
}) {
  const marker = useId();
  const positions = [
    [85, 70],
    [275, 70],
    [85, 230],
    [275, 230],
  ];
  const torusPaths = [
    'M100 70 L260 70',
    'M85 85 L85 215',
    'M263 61 Q180 -20 97 61',
    'M275 85 L275 215',
    'M100 230 L260 230',
    'M76 218 Q-15 150 76 82',
    'M263 239 Q180 320 97 239',
    'M284 218 Q375 150 284 82',
  ];
  const paths =
    model.geometry === 'torus'
      ? torusPaths
      : [torusPaths[0], torusPaths[1], torusPaths[3], torusPaths[4]];
  const labels =
    model.geometry === 'torus'
      ? [
          [180, 62],
          [65, 155],
          [180, 20],
          [293, 155],
          [180, 222],
          [24, 155],
          [180, 289],
          [337, 155],
        ]
      : [
          [180, 62],
          [65, 155],
          [293, 155],
          [180, 222],
        ];
  const highlighted = new Set(
    model.loops.find((l) => l.id === loop)?.boundary.map((e) => e.edgeId),
  );
  return (
    <div className="gauge-graph">
      <svg viewBox="0 0 360 310" role="group" aria-label={groupLabel}>
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {model.domain.edges.map((e, i) => (
          <g key={e.id}>
            <path
              d={paths[i]}
              fill="none"
              stroke={linkColors[i]}
              strokeWidth={edge === e.id ? 5 : highlighted.has(e.id) ? 3 : 2}
              strokeDasharray={e.wraps ? '6 4' : undefined}
              markerEnd={`url(#${marker})`}
              onClick={() => selectEdge(e.id)}
            />
            <rect
              x={labels[i]![0]! - 24}
              y={labels[i]![1]! - 23}
              width="48"
              height={linkDetails ? 44 : 32}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`Select link ${e.id}${e.wraps ? ' wrap' : ''}`}
              onClick={() => selectEdge(e.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectEdge(e.id);
                }
              }}
            />
            <text
              x={labels[i]![0]}
              y={labels[i]![1]}
              textAnchor="middle"
              fontSize="12"
              pointerEvents="none"
            >
              {linkLabels[i]}
              {linkDetails && (
                <tspan x={labels[i]![0]} dy="12" fontSize="10">
                  {linkDetails[i]}
                </tspan>
              )}
            </text>
          </g>
        ))}
        {model.domain.vertices.map((v, i) => (
          <g
            key={v.id}
            role="button"
            tabIndex={0}
            aria-label={`Select vertex ${v.id}`}
            onClick={() => selectVertex(v.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectVertex(v.id);
              }
            }}
          >
            <circle
              cx={positions[i]![0]}
              cy={positions[i]![1]}
              r="15"
              fill={vertex === v.id ? '#f0cb73' : '#f5f1e8'}
              stroke="#1d403f"
            />
            <text
              x={positions[i]![0]}
              y={positions[i]![1]! + 4}
              fontSize="12"
              textAnchor="middle"
            >
              {v.id}
            </text>
          </g>
        ))}
      </svg>
      <div className="gauge-faces" aria-label="Plaquette values">
        {model.domain.faces.map((f, i) => (
          <button
            type="button"
            key={f.id}
            aria-pressed={face === f.id}
            onClick={() => selectFace(f.id)}
          >
            {faceLabels[i]}
          </button>
        ))}
      </div>
      <div className="gauge-selectors">
        <label>
          Selected link
          <select value={edge} onChange={(e) => selectEdge(e.target.value)}>
            {model.domain.edges.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} · {e.tail} → {e.head}
                {e.wraps ? ' · wrap' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Selected vertex
          <select value={vertex} onChange={(e) => selectVertex(e.target.value)}>
            {model.domain.vertices.map((v) => (
              <option key={v.id}>{v.id}</option>
            ))}
          </select>
        </label>
        <label>
          Selected face
          <select value={face} onChange={(e) => selectFace(e.target.value)}>
            {model.domain.faces.map((f) => (
              <option key={f.id}>{f.id}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="plot-note">
        Vertices label gauge transformations; the physical variables live on
        links. Solid and dashed wrap links are distinct. {note}
        Selected face {face}; selected link {edge}.
      </p>
    </div>
  );
}
