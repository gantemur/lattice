/**
 * Small graph/cell-complex topology, independent of Ising couplings or drawing.
 * Edge IDs are physical bond records: equal endpoints never imply one edge.
 * A face boundary is an oriented walk through edge IDs, with sign -1 when
 * traversed opposite to the stored tail → head direction.
 */
export type Vertex = { id: string };
export type Edge = {
  id: string;
  tail: string;
  head: string;
  axis?: number;
  wraps?: boolean;
};
export type Face = { id: string; boundary: { edgeId: string; sign: 1 | -1 }[] };
export type Domain = {
  id: string;
  name: string;
  vertices: Vertex[];
  edges: Edge[];
  faces: Face[];
  lattice?: { lengths: number[]; boundary: 'open' | 'periodic' };
};
export const presetNames = {
  site: 'Single site',
  path: 'Open four-site chain',
  ring: 'Periodic 1×4 chain',
  square: 'Open 2×2 square',
  star: 'Four-site star',
  complete: 'Complete graph K4',
  torus: 'Periodic 2×2 square lattice',
} as const;
export type GraphPreset = keyof typeof presetNames;
export function graphPreset(kind: GraphPreset): Domain {
  const domain: Domain = {
    id: kind,
    name: presetNames[kind],
    vertices: Array.from({ length: kind === 'site' ? 1 : 4 }, (_, i) => ({
      id: `v${i}`,
    })),
    edges: [],
    faces: [],
  };
  const add = (tail: number, head: number, axis?: number, wraps = false) => {
    const id = `e${domain.edges.length}`;
    domain.edges.push({ id, tail: `v${tail}`, head: `v${head}`, axis, wraps });
    return id;
  };
  if (kind === 'path' || kind === 'ring') {
    for (let i = 0; i < 3; i++) add(i, i + 1, 0);
    if (kind === 'ring') add(3, 0, 0, true);
    domain.lattice = {
      lengths: [4],
      boundary: kind === 'ring' ? 'periodic' : 'open',
    };
  } else if (kind === 'star') {
    for (let i = 1; i < 4; i++) add(0, i);
  } else if (kind === 'complete') {
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) add(i, j);
  } else if (kind === 'square' || kind === 'torus') {
    const periodic = kind === 'torus';
    const ids = new Map<string, string>();
    const at = (x: number, y: number) => (x % 2) + 2 * (y % 2);
    // Row-major i=x+2y. On the torus, each site contributes a +x and a +y
    // bond; length-two wrapping makes parallel bonds, not duplicate records.
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const i = at(x, y);
        if (x === 0 || periodic)
          ids.set(`${i}:0`, add(i, at(x + 1, y), 0, x === 1));
        if (y === 0 || periodic)
          ids.set(`${i}:1`, add(i, at(x, y + 1), 1, y === 1));
      }
    // Four oriented plaquettes survive on the torus even though a four-spin
    // Ising energy can be reproduced on a different abstract interaction graph.
    for (let y = 0; y < (periodic ? 2 : 1); y++)
      for (let x = 0; x < (periodic ? 2 : 1); x++) {
        domain.faces.push({
          id: `f${domain.faces.length}`,
          boundary: [
            { edgeId: ids.get(`${at(x, y)}:0`)!, sign: 1 },
            { edgeId: ids.get(`${at(x + 1, y)}:1`)!, sign: 1 },
            { edgeId: ids.get(`${at(x, y + 1)}:0`)!, sign: -1 },
            { edgeId: ids.get(`${at(x, y)}:1`)!, sign: -1 },
          ],
        });
      }
    domain.lattice = {
      lengths: [2, 2],
      boundary: periodic ? 'periodic' : 'open',
    };
  }
  return domain;
}
export function validateDomain(domain: Domain): void {
  // Validate the closed incidence walk, not just its set of edge IDs. Gauge
  // observables later depend on this orientation; Ising energy does not.
  const vertices = new Set(domain.vertices.map((v) => v.id));
  const edges = new Map(domain.edges.map((e) => [e.id, e]));
  if (
    vertices.size !== domain.vertices.length ||
    vertices.size < 1 ||
    vertices.size > 4
  )
    throw new Error('Use 1–4 distinct vertices.');
  if (edges.size !== domain.edges.length || edges.size > 16)
    throw new Error('Use at most 16 uniquely identified edges.');
  if (new Set(domain.faces.map((f) => f.id)).size !== domain.faces.length)
    throw new Error('Duplicate face ID.');
  for (const edge of domain.edges)
    if (!vertices.has(edge.tail) || !vertices.has(edge.head))
      throw new Error('Unknown edge endpoint.');
  for (const face of domain.faces) {
    if (!face.boundary.length) throw new Error('Empty face boundary.');
    let first: string | undefined, last: string | undefined;
    for (const incidence of face.boundary) {
      const edge = edges.get(incidence.edgeId);
      if (!edge || (incidence.sign !== 1 && incidence.sign !== -1))
        throw new Error('Invalid face incidence.');
      const tail = incidence.sign === 1 ? edge.tail : edge.head,
        head = incidence.sign === 1 ? edge.head : edge.tail;
      first ??= tail;
      if (last !== undefined && last !== tail)
        throw new Error('Face boundary is not an oriented walk.');
      last = head;
    }
    if (last !== first) throw new Error('Face boundary is not closed.');
  }
}
/** Drawing coordinates never participate in action or transition calculations. */
export function drawingPositions(
  domain: Domain,
): Record<string, [number, number]> {
  const points: [number, number][] =
    domain.vertices.length === 1
      ? [[180, 115]]
      : domain.id === 'ring'
        ? [
            [85, 60],
            [275, 60],
            [275, 190],
            [85, 190],
          ]
        : domain.id === 'path'
          ? [
              [45, 115],
              [135, 115],
              [225, 115],
              [315, 115],
            ]
          : domain.id === 'star'
            ? [
                [180, 115],
                [70, 55],
                [290, 55],
                [180, 200],
              ]
            : [
                [85, 60],
                [275, 60],
                [85, 190],
                [275, 190],
              ];
  return Object.fromEntries(domain.vertices.map((v, i) => [v.id, points[i]!]));
}
export function topologyKey(domain: Domain): string {
  return JSON.stringify([
    domain.vertices.map((v) => v.id),
    domain.edges.map((e) => [e.id, e.tail, e.head]),
    domain.faces,
    domain.lattice,
  ]);
}
