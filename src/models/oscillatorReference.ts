import type { OscillatorParameters } from './oscillator';
import { oscillatorSpacing } from './oscillator';

export function latticeGap(p: OscillatorParameters): number {
  const a = oscillatorSpacing(p);
  return (2 / a) * Math.asinh((a * p.omega) / 2);
}

/** Fourier eigenvalues of Q=aω² I + a⁻¹ times the periodic bond Laplacian. */
export function oscillatorEigenvalues(p: OscillatorParameters): number[] {
  const a = oscillatorSpacing(p);
  return Array.from(
    { length: p.sites },
    (_, k) =>
      a * p.omega ** 2 + (4 / a) * Math.sin((Math.PI * k) / p.sites) ** 2,
  );
}

export function fourierCorrelator(p: OscillatorParameters): number[] {
  const eigenvalues = oscillatorEigenvalues(p);
  return Array.from(
    { length: p.sites },
    (_, lag) =>
      eigenvalues.reduce(
        (sum, lambda, k) =>
          sum + Math.cos((2 * Math.PI * k * lag) / p.sites) / lambda,
        0,
      ) / p.sites,
  );
}

/** Closed finite-spacing thermal correlator, independently of the DFT sum. */
export function latticeCorrelator(
  p: OscillatorParameters,
  lag: number,
): number {
  if (!Number.isInteger(lag) || lag < 0 || lag >= p.sites)
    throw new Error('Invalid Euclidean-time separation.');
  const a = oscillatorSpacing(p);
  const gap = latticeGap(p);
  return (
    (a / (2 * Math.sinh(a * gap))) *
    (Math.cosh(gap * (p.beta / 2 - lag * a)) / Math.sinh((gap * p.beta) / 2))
  );
}

export function continuumCorrelator(
  p: OscillatorParameters,
  time: number,
): number {
  oscillatorSpacing(p);
  if (!Number.isFinite(time) || time < 0 || time > p.beta)
    throw new Error('Invalid continuum Euclidean time.');
  return (
    Math.cosh(p.omega * (p.beta / 2 - time)) /
    (2 * p.omega * Math.sinh((p.omega * p.beta) / 2))
  );
}

/** Product-Lebesgue Gaussian integral and kinetic-normalized trace differ. */
export function oscillatorPartition(p: OscillatorParameters) {
  const a = oscillatorSpacing(p);
  const logRaw =
    (p.sites / 2) * Math.log(2 * Math.PI) -
    oscillatorEigenvalues(p).reduce(
      (sum, lambda) => sum + Math.log(lambda),
      0,
    ) /
      2;
  const logQuantum = logRaw - (p.sites / 2) * Math.log(2 * Math.PI * a);
  const gap = latticeGap(p);
  const logQuantumTransfer = -Math.log(2 * Math.sinh((p.beta * gap) / 2));
  return { logRaw, logQuantum, logQuantumTransfer };
}
