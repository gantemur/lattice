import { isingGraphPreset, validateDomain } from './graph';
import type { Domain } from './graph';
import { createIndexedLattice } from './indexedLattice';
import type { LatticeShape } from './indexedLattice';

export const pottsGeometries = {
  site: 'Single site',
  dimer: 'Open dimer',
  chain3: 'Three-site chain',
  triangle: 'Triangle',
  square: 'Open 2×2 square',
  torus: 'Periodic 2×2 torus',
} as const;
export type PottsGeometry = keyof typeof pottsGeometries;
export type PottsGeometrySettings =
  | { kind: 'graph'; domain: Domain; couplings: Record<string, number> }
  | { kind: 'lattice'; shape: LatticeShape; kx: number; ky: number };
export type PottsBond = {
  id: string;
  tail: number;
  head: number;
  K: number;
  axis?: number;
  wraps?: boolean;
};
export type PottsDomain = {
  size: number;
  siteIds: string[];
  bonds: PottsBond[];
  /** Every physical non-self bond has one incidence at each endpoint. */
  incident: { bond: number; neighbor: number }[][];
  graph?: Domain;
  shape?: LatticeShape;
};
export function validatePottsCoupling(value: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > 4)
    throw new Error('Potts couplings and source must be finite in [−4,4].');
}
export function pottsGraph(
  geometry: PottsGeometry,
  K = 0.7,
): PottsGeometrySettings {
  if (!Object.hasOwn(pottsGeometries, geometry))
    throw new Error('Unknown Potts geometry.');
  const domain = isingGraphPreset(geometry);
  return {
    kind: 'graph',
    domain,
    couplings: Object.fromEntries(domain.edges.map((e) => [e.id, K])),
  };
}
/** A narrow adapter, not a new geometry framework. Keep all original oriented
 * graph faces and physical bonds; equality interactions ignore orientation but
 * never collapse parallel records or remove a present K=0 interaction. */
export function pottsDomain(settings: PottsGeometrySettings): PottsDomain {
  let siteIds: string[], bonds: PottsBond[];
  let graph: Domain | undefined, shape: LatticeShape | undefined;
  if (settings.kind === 'graph') {
    validateDomain(settings.domain);
    graph = structuredClone(settings.domain);
    siteIds = graph.vertices.map((v) => v.id);
    if (siteIds.length > 4)
      throw new Error('Small Potts graphs have at most four sites.');
    if (
      Object.keys(settings.couplings).sort().join('|') !==
      graph.edges
        .map((e) => e.id)
        .sort()
        .join('|')
    )
      throw new Error('Couplings must match exactly the physical bond IDs.');
    bonds = graph.edges.map((e) => ({
      ...e,
      tail: siteIds.indexOf(e.tail),
      head: siteIds.indexOf(e.head),
      K: settings.couplings[e.id]!,
    }));
  } else if (settings.kind === 'lattice') {
    const { lx, ly, periodicX, periodicY } = settings.shape;
    if (
      !Number.isInteger(lx) ||
      !Number.isInteger(ly) ||
      lx < 2 ||
      ly < 2 ||
      lx > 32 ||
      ly > 32
    )
      throw new Error('Potts rectangles require Lx,Ly from 2 to 32.');
    validatePottsCoupling(settings.kx);
    validatePottsCoupling(settings.ky);
    shape = { lx, ly, periodicX, periodicY };
    const lattice = createIndexedLattice(shape);
    siteIds = Array.from({ length: lattice.size }, (_, i) => `v${i}`);
    bonds = Array.from(lattice.tails, (tail, b) => {
      const axis = lattice.axes[b]!,
        head = lattice.heads[b]!;
      return {
        id: `e${b}`,
        tail,
        head,
        axis,
        K: axis === 0 ? settings.kx : settings.ky,
        wraps:
          axis === 0 ? tail % lx === lx - 1 : Math.floor(tail / lx) === ly - 1,
      };
    });
  } else throw new Error('Unknown Potts domain kind.');
  const incident: PottsDomain['incident'] = siteIds.map(() => []);
  bonds.forEach((b, index) => {
    validatePottsCoupling(b.K);
    // Self-links remain in the full action but have no conditional dependence.
    if (b.tail !== b.head) {
      incident[b.tail]!.push({ bond: index, neighbor: b.head });
      incident[b.head]!.push({ bond: index, neighbor: b.tail });
    }
  });
  return { size: siteIds.length, siteIds, bonds, incident, graph, shape };
}
/** Support identity excludes physical weights, but retains IDs, orientation,
 * faces and boundaries. A topology change is never a parameter segment. */
export function pottsTopology(settings: PottsGeometrySettings): string {
  return JSON.stringify(
    settings.kind === 'graph' ? settings.domain : settings.shape,
  );
}
