import type { FourierBasis } from '../models/fieldFourier';

/** Full-segment plug-in E[|F(phi−μ)|²]/N from E[phi_i phi_j] and E[phi_i].
 * Here μ is the theoretical mean, not a fitted sample mean. No vector history
 * is required, so eviction of the plotting window cannot change this value. */
export function sampledModePower(
  basis: FourierBasis,
  mode: number,
  pairProducts: readonly (readonly number[])[],
  siteMeans: readonly number[],
  theoreticalMean: readonly number[],
): number {
  if (
    !Number.isInteger(mode) ||
    mode < 0 ||
    mode >= basis.size ||
    pairProducts.length !== basis.size ||
    siteMeans.length !== basis.size ||
    theoreticalMean.length !== basis.size ||
    pairProducts.some((row) => row.length !== basis.size)
  )
    throw new Error('Invalid mode-power aggregates.');
  let power = 0;
  for (let i = 0; i < basis.size; i++)
    for (let j = 0; j < basis.size; j++) {
      const centeredProduct =
        pairProducts[i]![j]! -
        theoreticalMean[i]! * siteMeans[j]! -
        theoreticalMean[j]! * siteMeans[i]! +
        theoreticalMean[i]! * theoreticalMean[j]!;
      const phaseDifference =
        basis.cosine[mode]![i]! * basis.cosine[mode]![j]! +
        basis.sine[mode]![i]! * basis.sine[mode]![j]!;
      power += phaseDifference * centeredProduct;
    }
  return power / basis.size;
}
