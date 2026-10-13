import type { FieldShape } from '../domain/fieldLattice';
import { createFieldLattice } from '../domain/fieldLattice';

/** Average ordered origin/displacement pairs, using site-specific ensemble
 * means with a source. Never subtract each configuration's spatial average.
 * At j=0 reflection symmetry gives exact zero site means even in an open box. */
export function phi4Correlations(
  shape: FieldShape,
  pair: readonly (readonly number[])[],
  means: readonly number[],
  source: number,
  axis: 'x' | 'y',
) {
  const size = createFieldLattice(shape).size;
  if (
    pair.length !== size ||
    means.length !== size ||
    pair.some((row) => row.length !== size)
  )
    throw new Error('Spatial pair matrix has wrong dimensions.');
  if (shape.kind === 'chain' && axis === 'y') return [];
  const lx = shape.kind === 'chain' ? shape.length : shape.lx;
  const ly = shape.kind === 'chain' ? 1 : shape.ly;
  const length = axis === 'x' ? lx : ly;
  const periodic =
    shape.kind === 'chain'
      ? shape.periodic
      : axis === 'x'
        ? shape.periodicX
        : shape.periodicY;
  const maxLag = periodic ? Math.floor(length / 2) : length - 1;
  return Array.from({ length: maxLag + 1 }, (_, lag) => {
    let raw = 0,
      centered = 0,
      pairs = 0;
    for (let y = 0; y < ly; y++)
      for (let x = 0; x < lx; x++) {
        const displaced = (axis === 'x' ? x : y) + lag;
        if (!periodic && displaced >= length) continue;
        const i = x + lx * y;
        const k =
          axis === 'x' ? (displaced % lx) + lx * y : x + lx * (displaced % ly);
        raw += pair[i]![k]!;
        centered += pair[i]![k]! - (source === 0 ? 0 : means[i]! * means[k]!);
        pairs++;
      }
    return { lag, pairs, raw: raw / pairs, connected: centered / pairs };
  });
}
