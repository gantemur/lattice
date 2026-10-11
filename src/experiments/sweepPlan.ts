import { validateSeed } from '../algorithms/rng';
import {
  defaultLatticeConfiguration,
  validateLatticeSettings,
} from '../engine/latticeRun';
import type {
  LatticeConfiguration,
  LatticeSettings,
} from '../engine/latticeRun';

export const SWEEP_PLAN_VERSION = 1;
export const SWEEP_SEED_RULE = 'indexed-golden-ratio-v1';
export const MAX_SWEEP_POINTS = 12;
export const MAX_SWEEP_MEASUREMENTS = 8192;
export const MAX_SWEEP_UPDATES = 10_000_000;
export type SweepAxis = 'temperature' | 'field' | 'jx' | 'jy' | 'size';
export type SweepPlan = {
  planVersion: typeof SWEEP_PLAN_VERSION;
  name: string;
  description: string;
  question: string;
  base: LatticeSettings & {
    initialization: LatticeConfiguration['initialization'];
  };
  varying: SweepAxis;
  values: number[];
  baseSeed: number;
  seedRule: typeof SWEEP_SEED_RULE;
  measurementsPerPoint: number;
};
export type SweepBudget = {
  totalUpdates: number;
  totalNominalSweeps: number;
  pointUpdates: number[];
  estimatedArchiveBytes: number;
};

function text(value: unknown, name: string, limit: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new Error(
      `${name} must be nonempty text of at most ${limit} characters.`,
    );
  return value;
}

/** Odd 32-bit multiplier gives distinct indexed seeds for our bounded points. */
export function pointSeed(baseSeed: number, index: number): number {
  validateSeed(baseSeed);
  if (!Number.isSafeInteger(index) || index < 0 || index >= MAX_SWEEP_POINTS)
    throw new Error('Point index is outside the sweep budget.');
  return (baseSeed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
}

export function pointConfiguration(
  plan: SweepPlan,
  index: number,
): LatticeConfiguration {
  const value = plan.values[index];
  if (value === undefined) throw new Error('Unknown sweep point.');
  const parameters = { ...plan.base.parameters };
  if (plan.varying === 'size') parameters.lx = parameters.ly = value;
  else parameters[plan.varying] = value;
  return {
    ...plan.base,
    parameters,
    seed: pointSeed(plan.baseSeed, index),
  };
}

export function validateSweepPlan(value: SweepPlan): SweepBudget {
  if (!value || value.planVersion !== SWEEP_PLAN_VERSION)
    throw new Error('Unsupported sweep plan version.');
  text(value.name, 'Sweep name', 120);
  text(value.description, 'Description', 1000);
  text(value.question, 'Experiment question', 500);
  if (!['temperature', 'field', 'jx', 'jy', 'size'].includes(value.varying))
    throw new Error('Choose exactly one supported varying parameter.');
  if (value.seedRule !== SWEEP_SEED_RULE)
    throw new Error('Unsupported point-seed derivation rule.');
  validateSeed(value.baseSeed);
  if (
    !Number.isSafeInteger(value.measurementsPerPoint) ||
    value.measurementsPerPoint < 1 ||
    value.measurementsPerPoint > MAX_SWEEP_MEASUREMENTS
  )
    throw new Error('Use 1–8192 retained measurements per point.');
  if (
    !Array.isArray(value.values) ||
    value.values.length < 2 ||
    value.values.length > MAX_SWEEP_POINTS
  )
    throw new Error('Use 2–12 ordered parameter values.');
  if (new Set(value.values).size !== value.values.length)
    throw new Error('Sweep point values must be distinct.');
  if (!['plus', 'minus', 'random'].includes(value.base?.initialization))
    throw new Error('Unknown point initialization policy.');
  validateLatticeSettings(value.base);
  const pointUpdates = value.values.map((parameter, index) => {
    if (!Number.isFinite(parameter))
      throw new Error(`Point ${index + 1} has a non-finite parameter.`);
    const configuration = pointConfiguration(value, index);
    validateLatticeSettings(configuration);
    const { lx, ly } = configuration.parameters;
    return (
      lx *
      ly *
      (configuration.warmupSweeps +
        configuration.strideSweeps * value.measurementsPerPoint)
    );
  });
  const totalUpdates = pointUpdates.reduce((sum, count) => sum + count, 0);
  if (!Number.isSafeInteger(totalUpdates) || totalUpdates > MAX_SWEEP_UPDATES)
    throw new Error('Sweep exceeds the 10 million elementary-update limit.');
  const totalNominalSweeps =
    value.values.length *
    (value.base.warmupSweeps +
      value.base.strideSweeps * value.measurementsPerPoint);
  // Conservative reservation for three raw rings, up to 1000 plot records,
  // moments/diagnostics/provenance, and UTF-8 numeric JSON overhead.
  const estimatedArchiveBytes =
    value.values.length * (120_000 + 120 * value.measurementsPerPoint);
  return {
    totalUpdates,
    totalNominalSweeps,
    pointUpdates,
    estimatedArchiveBytes,
  };
}

function base() {
  const { seed: _seed, ...configuration } = defaultLatticeConfiguration;
  return {
    ...configuration,
    parameters: {
      ...configuration.parameters,
      lx: 16,
      ly: 16,
      periodicX: true,
      periodicY: true,
      jx: 1,
      jy: 1,
      field: 0,
    },
    warmupSweeps: 100,
    strideSweeps: 1,
    initialization: 'random' as const,
  };
}

export const sweepPresets: Record<'temperature' | 'field' | 'size', SweepPlan> =
  {
    temperature: {
      planVersion: 1,
      name: 'Temperature scan',
      description:
        'Periodic isotropic 16×16 Ising lattice across the theoretical Tc.',
      question: 'How do e, |m|, susceptibility and Binder vary with T?',
      base: base(),
      varying: 'temperature',
      values: [1.6, 1.9, 2.1, 2.269185314213022, 2.45, 2.8, 3.2],
      baseSeed: 12345,
      seedRule: SWEEP_SEED_RULE,
      measurementsPerPoint: 256,
    },
    field: {
      planVersion: 1,
      name: 'External-field response',
      description:
        'Signed fields across zero on a fixed periodic 16×16 lattice.',
      question: 'How does finite-volume magnetization respond to h?',
      base: {
        ...base(),
        parameters: { ...base().parameters, temperature: 2.5 },
      },
      varying: 'field',
      values: [-1, -0.5, -0.2, 0, 0.2, 0.5, 1],
      baseSeed: 12345,
      seedRule: SWEEP_SEED_RULE,
      measurementsPerPoint: 256,
    },
    size: {
      planVersion: 1,
      name: 'Finite-size comparison',
      description:
        'Independent square lattices near the isotropic theoretical Tc.',
      question: 'How does the finite-volume crossover change with L?',
      base: base(),
      varying: 'size',
      values: [4, 8, 16, 32],
      baseSeed: 12345,
      seedRule: SWEEP_SEED_RULE,
      measurementsPerPoint: 256,
    },
  };
