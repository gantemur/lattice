import type { IndexedLattice } from '../domain/indexedLattice';

/** Mean product over the actual positive-axis bond records, including parallels. */
export function bondProducts(lattice: IndexedLattice, spins: Int8Array) {
  let x = 0;
  let y = 0;
  for (let bond = 0; bond < lattice.tails.length; bond++) {
    const product = spins[lattice.tails[bond]!]! * spins[lattice.heads[bond]!]!;
    if (lattice.axes[bond] === 0) x += product;
    else y += product;
  }
  return {
    x: x / lattice.horizontalBonds,
    y: y / lattice.verticalBonds,
  };
}

export type Axis = 'x' | 'y';
export type SpatialPoint = { r: number; pairs: number; value: number };
export const MAX_SPATIAL_LAG = 4;

/** Global-mean centering is shown only when both axes are translation invariant. */
export function spatialDisplayValue(
  boundaries: { periodicX: boolean; periodicY: boolean },
  raw: number,
  meanM: number,
) {
  // On an open/mixed lattice site means can vary by position. Subtracting
  // global <m>² there would not generally yield a connected covariance.
  const connected = boundaries.periodicX && boundaries.periodicY;
  return {
    kind: connected ? ('connected' as const) : ('raw' as const),
    value: connected ? raw - meanM * meanM : raw,
  };
}

/** Ordered origin/displacement pairs; periodic directions wrap, open ones stop. */
export function axialProducts(
  lattice: IndexedLattice,
  spins: Int8Array,
  axis: Axis,
  maximum = MAX_SPATIAL_LAG,
): SpatialPoint[] {
  const length = axis === 'x' ? lattice.lx : lattice.ly;
  const periodic = axis === 'x' ? lattice.periodicX : lattice.periodicY;
  const largest = Math.min(
    maximum,
    periodic ? Math.floor(length / 2) : length - 1,
  );
  const points: SpatialPoint[] = [];
  for (let r = 0; r <= largest; r++) {
    let total = 0;
    let pairs = 0;
    for (let y = 0; y < lattice.ly; y++)
      for (let x = 0; x < lattice.lx; x++) {
        const otherX = axis === 'x' ? x + r : x;
        const otherY = axis === 'y' ? y + r : y;
        if (!periodic && (otherX >= lattice.lx || otherY >= lattice.ly))
          continue;
        const i = x + lattice.lx * y;
        const j = (otherX % lattice.lx) + lattice.lx * (otherY % lattice.ly);
        total += spins[i]! * spins[j]!;
        pairs++;
      }
    points.push({ r, pairs, value: total / pairs });
  }
  return points;
}

export function equilibriumFluctuations(
  size: number,
  temperature: number,
  meanM2: number,
  meanM4: number,
  varianceM: number,
  varianceE: number,
) {
  // Finite-volume equilibrium identities: χ=N Var(m)/T and
  // cV=N Var(e)/T², with e=H/N. Binder uses <m⁴>/<m²>².
  const variance = (value: number) => {
    if (!Number.isFinite(value) || value < -1e-12)
      throw new Error('Invalid equilibrium fluctuation variance.');
    return Math.max(0, value);
  };
  const mVariance = variance(varianceM);
  const eVariance = variance(varianceE);
  return {
    susceptibility: (size * mVariance) / temperature,
    binder:
      meanM2 > 32 * Number.EPSILON ? 1 - meanM4 / (3 * meanM2 * meanM2) : null,
    specificHeat: (size * eVariance) / (temperature * temperature),
  };
}
