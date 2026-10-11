import type { ScalarSegmentSnapshot } from './scalarRun';
import type { IsingMeasurementSnapshot } from '../observables/isingMeasurements';
import type { Settings } from '../algorithms/transitions';
import type { Histogram } from '../observables/histogram';
import type { summarizeMoments } from '../observables/moments';
import type { Checkpoint } from '../observables/convergence';
import type { TransitionRecord } from '../observables/trajectory';

export const MAX_SEGMENTS = 8;
export type RunConfiguration = Settings & Readonly<{ seed: number }>;
export type SegmentSnapshot = Settings & {
  ising?: IsingMeasurementSnapshot;
  scalar?: ScalarSegmentSnapshot;
  id: number;
  startUpdate: number;
  initialValue: number | null;
  initialization: string;
  updates: number;
  warmupUpdates: number;
  warmupTarget: number;
  accepted: number;
  rejected: number;
  self: number;
  moments: ReturnType<typeof summarizeMoments>;
  histogram: Histogram;
  convergence: Checkpoint[];
  trajectory: TransitionRecord[];
};
export type Snapshot = {
  runId: number;
  version: number;
  configuration: RunConfiguration;
  currentValue: number | null;
  scalarState?: number[];
  currentAction: number | null;
  updates: number;
  warmupUpdates: number;
  strideUpdates: 1;
  moments: SegmentSnapshot['moments'];
  histogram: Histogram;
  segments: SegmentSnapshot[];
  activeSegmentId: number;
  droppedSegments: number;
};
export type WorkerRequest =
  | { type: 'initialize'; runId: number; configuration: RunConfiguration }
  | { type: 'changeSettings'; runId: number; settings: Settings }
  | { type: 'advance'; runId: number; count: number }
  | { type: 'snapshot'; runId: number };
export type WorkerResponse =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'error'; runId: number; message: string };
