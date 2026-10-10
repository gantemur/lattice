import type { GaussianParameters } from '../models/gaussian';
import type { Histogram } from '../observables/histogram';
import type { summarizeMoments } from '../observables/moments';

export type RunConfiguration = Readonly<{
  parameters: GaussianParameters;
  seed: number;
}>;

export type Snapshot = {
  runId: number;
  version: number;
  configuration: RunConfiguration;
  currentValue: number | null;
  currentAction: number | null;
  updates: number;
  warmupUpdates: 0;
  strideUpdates: 1;
  moments: ReturnType<typeof summarizeMoments>;
  histogram: Histogram;
};

export type WorkerRequest =
  | { type: 'initialize'; runId: number; configuration: RunConfiguration }
  | { type: 'advance'; runId: number; count: number }
  | { type: 'snapshot'; runId: number };

export type WorkerResponse =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'error'; runId: number; message: string };
