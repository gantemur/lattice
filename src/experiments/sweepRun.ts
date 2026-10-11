import { LatticeRun } from '../engine/latticeRun';
import type { LatticeCapture } from '../engine/latticeRun';
import { pointConfiguration, validateSweepPlan } from './sweepPlan';
import type { SweepBudget, SweepPlan } from './sweepPlan';

export type SweepStatus =
  'ready' | 'running' | 'paused' | 'completed' | 'cancelled';
export type SweepProgress = {
  status: SweepStatus;
  pointIndex: number;
  completedPoints: number;
  currentPointUpdates: number;
  currentPointMeasurements: number;
  totalUpdates: number;
  requestedUpdates: number;
};
export type CompletedPoint = {
  index: number;
  value: number;
  seed: number;
  updates: number;
  capture: LatticeCapture;
};

function freezePlan<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezePlan(child);
    Object.freeze(value);
  }
  return value;
}

/** One independent LatticeRun per point; scheduling never enters its RNG. */
export class SweepRun {
  readonly plan: SweepPlan;
  readonly budget: SweepBudget;
  private status: SweepStatus = 'ready';
  private pointIndex = 0;
  private currentRun: LatticeRun | null = null;
  private currentPointUpdates = 0;
  private totalUpdates = 0;

  constructor(plan: SweepPlan) {
    this.budget = validateSweepPlan(plan);
    this.plan = freezePlan(structuredClone(plan));
  }
  start() {
    if (this.status !== 'ready') throw new Error('Sweep already started.');
    this.status = 'running';
  }
  pause() {
    if (this.status !== 'running') throw new Error('Sweep is not running.');
    this.status = 'paused';
  }
  resume() {
    if (this.status !== 'paused') throw new Error('Sweep is not paused.');
    this.status = 'running';
  }
  cancel() {
    if (this.status === 'completed' || this.status === 'cancelled')
      throw new Error('Sweep has already ended.');
    const partial = {
      index: this.pointIndex,
      updates: this.currentPointUpdates,
      measurements: this.progress().currentPointMeasurements,
    };
    this.status = 'cancelled';
    this.currentRun = null;
    return partial;
  }
  progress(): SweepProgress {
    const index = Math.min(this.pointIndex, this.plan.values.length - 1);
    const p = pointConfiguration(this.plan, index);
    const sweeps = Math.floor(
      this.currentPointUpdates / (p.parameters.lx * p.parameters.ly),
    );
    const currentPointMeasurements = Math.max(
      0,
      Math.floor((sweeps - p.warmupSweeps) / p.strideSweeps),
    );
    return {
      status: this.status,
      pointIndex: this.pointIndex,
      completedPoints: this.pointIndex,
      currentPointUpdates: this.currentPointUpdates,
      currentPointMeasurements,
      totalUpdates: this.totalUpdates,
      requestedUpdates: this.budget.totalUpdates,
    };
  }
  advance(batchSize = 4096): CompletedPoint | null {
    if (this.status !== 'running') return null;
    if (!Number.isSafeInteger(batchSize) || batchSize < 1)
      throw new Error('Batch size must be a positive integer.');
    const index = this.pointIndex;
    const target = this.budget.pointUpdates[index];
    if (target === undefined) throw new Error('No remaining sweep point.');
    if (!this.currentRun)
      this.currentRun = new LatticeRun(
        index + 1,
        pointConfiguration(this.plan, index),
      );
    const count = Math.min(8192, batchSize, target - this.currentPointUpdates);
    this.currentRun.advance(count);
    this.currentPointUpdates += count;
    this.totalUpdates += count;
    if (this.currentPointUpdates < target) return null;
    const configuration = pointConfiguration(this.plan, index);
    const completed: CompletedPoint = {
      index,
      value: this.plan.values[index]!,
      seed: configuration.seed,
      updates: this.currentPointUpdates,
      capture: this.currentRun.capture(1, true),
    };
    this.pointIndex++;
    this.currentRun = null;
    this.currentPointUpdates = 0;
    if (this.pointIndex === this.plan.values.length) this.status = 'completed';
    return completed;
  }
}
