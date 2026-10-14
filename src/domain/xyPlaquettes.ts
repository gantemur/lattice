import type { XYDomain } from './xyDomain';
export type XYPlaquette = {
  id: string;
  boundary: { bond: number; sign: 1 | -1 }[];
  x?: number;
  y?: number;
};
/** Faces are declared cell structure, never inferred from an arbitrary cycle.
 * Indexed geometry is read only. Positive-axis bond IDs/order stay unchanged. */
export function xyPlaquettes(domain: XYDomain): XYPlaquette[] {
  if (domain.graph)
    return domain.graph.faces.map((face, f) => ({
      id: face.id,
      boundary: face.boundary.map(({ edgeId, sign }) => ({
        bond: domain.bonds.findIndex((b) => b.id === edgeId),
        sign,
      })),
      ...(domain.graph!.lattice?.lengths.length === 2
        ? {
            x: f % (domain.graph!.id === 'torus' ? 2 : 1),
            y: Math.floor(f / 2),
          }
        : {}),
    }));
  if (!domain.shape) return [];
  const { lx, ly, periodicX, periodicY } = domain.shape;
  const ids = new Map(domain.bonds.map((b, i) => [`${b.tail}:${b.axis}`, i]));
  const at = (x: number, y: number) => (x % lx) + lx * (y % ly);
  const faces: XYPlaquette[] = [];
  for (let y = 0; y < (periodicY ? ly : ly - 1); y++)
    for (let x = 0; x < (periodicX ? lx : lx - 1); x++)
      faces.push({
        id: `f${faces.length}`,
        x,
        y,
        boundary: [
          { bond: ids.get(`${at(x, y)}:0`)!, sign: 1 },
          { bond: ids.get(`${at(x + 1, y)}:1`)!, sign: 1 },
          { bond: ids.get(`${at(x, y + 1)}:0`)!, sign: -1 },
          { bond: ids.get(`${at(x, y)}:1`)!, sign: -1 },
        ],
      });
  return faces;
}
