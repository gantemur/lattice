import type { GaussianParameters } from '../models/gaussian';
import type { Histogram } from '../observables/histogram';
import type { summarizeMoments } from '../observables/moments';
import type { Checkpoint } from '../observables/convergence';

export type RunConfiguration = Readonly<{
  parameters: GaussianParameters;
  seed: number;
}>;
export type SegmentSnapshot = {
  id: number;
  parameters: GaussianParameters;
  startUpdate: number;
  moments: ReturnType<typeof summarizeMoments>;
  histogram: Histogram;
  convergence: Checkpoint[];
};
export type Snapshot = {
  runId: number;
  version: number;
  configuration: RunConfiguration;
  currentValue: number | null;
  currentAction: number | null;
  updates: number;
  warmupUpdates: 0;
  strideUpdates: 1;
  moments: SegmentSnapshot['moments'];
  histogram: Histogram;
  segments: SegmentSnapshot[];
  activeSegmentId: number;
  droppedSegments: number;
};
export type WorkerRequest =
  | { type: 'initialize'; runId: number; configuration: RunConfiguration }
  | { type: 'changeParameters'; runId: number; parameters: GaussianParameters }
  | { type: 'advance'; runId: number; count: number }
  | { type: 'snapshot'; runId: number };
export type WorkerResponse =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'error'; runId: number; message: string };
