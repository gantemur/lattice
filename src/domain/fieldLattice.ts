/**
 * Finite field geometry, independent of the action and sampler. A bond points
 * in the positive coordinate direction; an open side omits its wrap bond.
 * In particular, "open" does not impose a fixed zero-valued boundary site.
 * Length-two periodic axes retain two parallel bonds with distinct IDs.
 */
export type FieldShape =
  | { kind: 'chain'; length: number; periodic: boolean }
  | {
      kind: 'rectangle';
      lx: number;
      ly: number;
      periodicX: boolean;
      periodicY: boolean;
    };

export type FieldBond = {
  id: number;
  tail: number;
  head: number;
  axis: 'x' | 'y';
  wraps: boolean;
};
export type FieldLattice = {
  shape: FieldShape;
  size: number;
  bonds: FieldBond[];
  incident: FieldBond[][];
};

export function validateFieldShape(shape: FieldShape): void {
  if (shape.kind === 'chain') {
    if (
      !Number.isInteger(shape.length) ||
      shape.length < 2 ||
      shape.length > 64
    )
      throw new Error('Chain length must be an integer from 2 to 64.');
    if (typeof shape.periodic !== 'boolean')
      throw new Error('Chain boundary must be open or periodic.');
    return;
  }
  if (shape.kind !== 'rectangle') throw new Error('Unknown field geometry.');
  if (
    ![shape.lx, shape.ly].every(
      (length) => Number.isInteger(length) && length >= 2 && length <= 8,
    )
  )
    throw new Error('Rectangle sides must be integers from 2 to 8.');
  if (
    typeof shape.periodicX !== 'boolean' ||
    typeof shape.periodicY !== 'boolean'
  )
    throw new Error('Rectangle boundaries must be open or periodic.');
}

export function createFieldLattice(shape: FieldShape): FieldLattice {
  validateFieldShape(shape);
  const size = shape.kind === 'chain' ? shape.length : shape.lx * shape.ly;
  const bonds: FieldBond[] = [];
  const incident = Array.from({ length: size }, () => [] as FieldBond[]);
  function add(tail: number, head: number, axis: 'x' | 'y', wraps: boolean) {
    const bond = { id: bonds.length, tail, head, axis, wraps };
    bonds.push(bond);
    incident[tail]!.push(bond);
    incident[head]!.push(bond);
  }
  if (shape.kind === 'chain') {
    for (let x = 0; x < shape.length; x++)
      if (x + 1 < shape.length || shape.periodic)
        add(x, (x + 1) % shape.length, 'x', x + 1 === shape.length);
  } else {
    // Row-major site i=x+Lx*y; each existing +x/+y neighbor yields one bond.
    const { lx, ly, periodicX, periodicY } = shape;
    for (let y = 0; y < ly; y++)
      for (let x = 0; x < lx; x++) {
        const site = x + lx * y;
        if (x + 1 < lx || periodicX)
          add(site, ((x + 1) % lx) + lx * y, 'x', x + 1 === lx);
        if (y + 1 < ly || periodicY)
          add(site, x + lx * ((y + 1) % ly), 'y', y + 1 === ly);
      }
  }
  return { shape: structuredClone(shape), size, bonds, incident };
}
