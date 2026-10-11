/**
 * M2's compact rectangular Ising geometry, separate from the small graph's
 * explicit vertices/edges/faces. Sites use row-major i=x+Lx*y. Each site
 * creates its existing +x and +y bonds, so a periodic length-two axis has
 * two distinct oppositely oriented records between the same sites.
 */
export type LatticeShape = {
  lx: number;
  ly: number;
  periodicX: boolean;
  periodicY: boolean;
};
export type IndexedLattice = LatticeShape & {
  size: number;
  tails: Int32Array;
  heads: Int32Array;
  axes: Uint8Array;
  /** Four incident bond slots per site, retaining parallel-bond multiplicity. */
  neighbors: Int32Array;
  neighborAxes: Uint8Array;
  degree: Uint8Array;
  horizontalBonds: number;
  verticalBonds: number;
};

export function validateShape(shape: LatticeShape): void {
  if (
    ![shape.lx, shape.ly].every((n) => Number.isInteger(n) && n >= 2 && n <= 64)
  )
    throw new Error('Each lattice side must be an integer from 2 to 64.');
  if (
    typeof shape.periodicX !== 'boolean' ||
    typeof shape.periodicY !== 'boolean'
  )
    throw new Error('Boundary choices must be open or periodic.');
}

export function createIndexedLattice(shape: LatticeShape): IndexedLattice {
  validateShape(shape);
  const { lx, ly, periodicX, periodicY } = shape;
  const size = lx * ly;
  const horizontalBonds = (periodicX ? lx : lx - 1) * ly;
  const verticalBonds = lx * (periodicY ? ly : ly - 1);
  const count = horizontalBonds + verticalBonds;
  const tails = new Int32Array(count),
    heads = new Int32Array(count);
  const axes = new Uint8Array(count);
  const neighbors = new Int32Array(size * 4);
  const neighborAxes = new Uint8Array(size * 4);
  const degree = new Uint8Array(size);
  let bond = 0;
  // Both endpoints receive an incidence slot. Keeping separate slots for
  // parallel bonds makes local flip costs match the full bond sum exactly.
  const add = (tail: number, head: number, axis: number) => {
    tails[bond] = tail;
    heads[bond] = head;
    axes[bond++] = axis;
    const a = tail * 4 + degree[tail]!;
    degree[tail] = degree[tail]! + 1;
    const b = head * 4 + degree[head]!;
    degree[head] = degree[head]! + 1;
    neighbors[a] = head;
    neighbors[b] = tail;
    neighborAxes[a] = neighborAxes[b] = axis;
  };
  for (let y = 0; y < ly; y++)
    for (let x = 0; x < lx; x++) {
      const site = x + lx * y;
      if (x + 1 < lx || periodicX) add(site, ((x + 1) % lx) + lx * y, 0);
      if (y + 1 < ly || periodicY) add(site, x + lx * ((y + 1) % ly), 1);
    }
  return {
    ...shape,
    size,
    tails,
    heads,
    axes,
    neighbors,
    neighborAxes,
    degree,
    horizontalBonds,
    verticalBonds,
  };
}
