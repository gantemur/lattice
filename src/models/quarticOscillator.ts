import type { GaussianFieldParameters } from './gaussianField';

/** Physical units ℏ=kB=m=1. The periodic endpoint x_N repeats x_0. */
export type QuarticOscillatorParameters = {
  sites: number;
  beta: number;
  r: number;
  lambda: number;
  h: number;
};

export const defaultQuarticOscillator: QuarticOscillatorParameters = {
  sites: 16,
  beta: 8,
  r: -2,
  lambda: 1,
  h: 0,
};

export function validateQuarticOscillator(p: QuarticOscillatorParameters) {
  if (!Number.isInteger(p.sites) || p.sites < 4 || p.sites > 64)
    throw new Error('Time sites N must be an integer from 4 to 64.');
  if (!Number.isFinite(p.beta) || p.beta < 2 || p.beta > 16)
    throw new Error('Inverse temperature β must be from 2 to 16.');
  if (!Number.isFinite(p.r) || p.r < -4 || p.r > 16)
    throw new Error('Quadratic coefficient r must be from −4 to 16.');
  if (!Number.isFinite(p.h) || Math.abs(p.h) > 2)
    throw new Error('Tilt h must be from −2 to 2.');
  if (
    !Number.isFinite(p.lambda) ||
    (p.lambda !== 0 && (p.lambda < 0.05 || p.lambda > 4))
  )
    throw new Error('Quartic λ must be zero or from 0.05 to 4.');
  if (p.lambda === 0 && p.r < 0.0625)
    throw new Error('The supported Gaussian limit requires r≥0.0625.');
}

export function quarticSpacing(p: QuarticOscillatorParameters) {
  validateQuarticOscillator(p);
  return p.beta / p.sites;
}

/** V=r x²/2+λ x⁴/4−h x. This is a physical potential, not an action. */
export function quarticPotential(p: QuarticOscillatorParameters, x: number) {
  return (p.r * x * x) / 2 + (p.lambda * x ** 4) / 4 - p.h * x;
}

export function quarticPotentialDerivative(
  p: QuarticOscillatorParameters,
  x: number,
) {
  return p.r * x + p.lambda * x ** 3 - p.h;
}

/** The quadratic map is only an implementation decomposition of S. For
 * λ>0 it is not a Gaussian probability model or an exact reference. */
export function quarticQuadraticPart(
  p: QuarticOscillatorParameters,
): GaussianFieldParameters {
  const a = quarticSpacing(p);
  return {
    shape: { kind: 'chain', length: p.sites, periodic: true },
    r: a * p.r,
    kappaX: 1 / a,
    kappaY: 0,
    source: a * p.h,
  };
}

function validatePath(p: QuarticOscillatorParameters, path: readonly number[]) {
  if (path.length !== p.sites || path.some((x) => !Number.isFinite(x)))
    throw new Error('Quartic path must have N finite values.');
}

/** S_a=Σ[(x_(j+1)−x_j)²/(2a)+a V(x_j)], with N independent sites. */
export function quarticPathAction(
  p: QuarticOscillatorParameters,
  path: readonly number[],
) {
  const a = quarticSpacing(p);
  validatePath(p, path);
  let action = 0;
  for (let j = 0; j < p.sites; j++) {
    const x = path[j]!;
    action += (path[(j + 1) % p.sites]! - x) ** 2 / (2 * a);
    action += a * quarticPotential(p, x);
  }
  if (!Number.isFinite(action)) throw new Error('Quartic action overflowed.');
  return action;
}

/** Only two time bonds and one potential term change. N≥4 makes the two
 * neighboring sites distinct, including j=0 and j=N−1. */
export function quarticLocalDifference(
  p: QuarticOscillatorParameters,
  path: readonly number[],
  site: number,
  proposed: number,
) {
  const a = quarticSpacing(p);
  validatePath(p, path);
  if (!Number.isInteger(site) || site < 0 || site >= p.sites)
    throw new Error('Invalid time site.');
  if (!Number.isFinite(proposed)) throw new Error('Proposal must be finite.');
  const old = path[site]!;
  const left = path[(site + p.sites - 1) % p.sites]!;
  const right = path[(site + 1) % p.sites]!;
  const delta =
    ((proposed - left) ** 2 -
      (old - left) ** 2 +
      (right - proposed) ** 2 -
      (right - old) ** 2) /
      (2 * a) +
    a * (quarticPotential(p, proposed) - quarticPotential(p, old));
  if (!Number.isFinite(delta)) throw new Error('Quartic ΔS overflowed.');
  return delta;
}

export type PotentialStationaryPoint = {
  x: number;
  value: number;
  kind: 'minimum' | 'maximum' | 'flat';
};

function bisectRoot(
  p: QuarticOscillatorParameters,
  left: number,
  right: number,
) {
  let lower = left;
  let upper = right;
  let lowerValue = quarticPotentialDerivative(p, lower);
  for (let i = 0; i < 80; i++) {
    const middle = (lower + upper) / 2;
    const value = quarticPotentialDerivative(p, middle);
    if (lowerValue * value <= 0) upper = middle;
    else {
      lower = middle;
      lowerValue = value;
    }
  }
  return (lower + upper) / 2;
}

/** Partition V′=λx³+rx−h at its turning points, then bracket every root.
 * Supported parameter bounds make these finite brackets conservative. */
export function potentialStationaryPoints(
  p: QuarticOscillatorParameters,
): PotentialStationaryPoint[] {
  validateQuarticOscillator(p);
  if (p.lambda === 0) {
    const x = p.h / p.r;
    return [{ x, value: quarticPotential(p, x), kind: 'minimum' }];
  }
  const scale =
    2 +
    2 * Math.sqrt(Math.abs(p.r) / p.lambda) +
    2 * Math.cbrt(Math.abs(p.h) / p.lambda);
  const turn = p.r < 0 ? Math.sqrt(-p.r / (3 * p.lambda)) : 0;
  const cuts = turn > 0 ? [-scale, -turn, turn, scale] : [-scale, scale];
  const roots: number[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const left = cuts[i]!;
    const right = cuts[i + 1]!;
    const fLeft = quarticPotentialDerivative(p, left);
    const fRight = quarticPotentialDerivative(p, right);
    if (Math.abs(fLeft) < 1e-12) roots.push(left);
    if (fLeft * fRight < 0) roots.push(bisectRoot(p, left, right));
    if (i + 2 === cuts.length && Math.abs(fRight) < 1e-12) roots.push(right);
  }
  return roots
    .filter((x, i) => i === 0 || Math.abs(x - roots[i - 1]!) > 1e-8)
    .map((x) => {
      const curvature = p.r + 3 * p.lambda * x * x;
      return {
        x,
        value: quarticPotential(p, x),
        kind:
          curvature > 1e-10
            ? ('minimum' as const)
            : curvature < -1e-10
              ? ('maximum' as const)
              : ('flat' as const),
      };
    });
}

export function potentialMinimum(p: QuarticOscillatorParameters) {
  const points = potentialStationaryPoints(p);
  const minimum = points.reduce((best, next) =>
    next.value < best.value ? next : best,
  );
  return { ...minimum, stationaryPoints: points };
}

export function symmetricDoubleWell(p: QuarticOscillatorParameters) {
  validateQuarticOscillator(p);
  if (!(p.lambda > 0 && p.r < 0 && p.h === 0)) return null;
  return {
    minima: [-Math.sqrt(-p.r / p.lambda), Math.sqrt(-p.r / p.lambda)],
    barrier: (p.r * p.r) / (4 * p.lambda),
  };
}
