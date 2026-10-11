import type { ScalarSegmentSnapshot } from './scalarRun';
import type { IsingMeasurementSnapshot } from '../observables/isingMeasurements';
import type { Settings } from '../algorithms/transitions';
import type { Histogram } from '../observables/histogram';
import type { summarizeMoments } from '../observables/moments';
import type { Checkpoint } from '../observables/convergence';
import type { TransitionRecord } from '../observables/trajectory';
import type { DiagnosticRecord } from '../observables/statisticalDiagnostics';

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
export type SmallCapture = {
  workspace: 'small';
  runId: number;
  version: number;
  seed: number;
  captureUpdate: number;
  segment: SegmentSnapshot;
  diagnosticRecord: DiagnosticRecord | null;
  currentState: { update: number; value: number | number[] | null } | null;
};
export type WorkerRequest =
  | { type: 'initialize'; runId: number; configuration: RunConfiguration }
  | { type: 'changeSettings'; runId: number; settings: Settings }
  | { type: 'advance'; runId: number; count: number }
  | { type: 'snapshot'; runId: number }
  | { type: 'capture'; runId: number; requestId: number; segmentId: number };
export type WorkerResponse =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'capture'; runId: number; requestId: number; capture: SmallCapture }
  | { type: 'error'; runId: number; message: string };
