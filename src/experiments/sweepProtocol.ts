import type { CompletedPoint, SweepProgress } from './sweepRun';
import type { SweepPlan } from './sweepPlan';

export type SweepCommand =
  | { type: 'start'; sweepId: string; commandId: number; plan: SweepPlan }
  | { type: 'ack'; sweepId: string; commandId: number; pointIndex: number }
  | {
      type: 'pause' | 'resume' | 'cancel';
      sweepId: string;
      commandId: number;
    };
export type SweepReply =
  | {
      type: 'error';
      sweepId: string;
      commandId: number;
      sequence: number;
      error: string;
    }
  | {
      type: 'command-error';
      sweepId: string;
      commandId: number;
      sequence: number;
      progress: SweepProgress;
      error: string;
    }
  | {
      type: 'state';
      sweepId: string;
      commandId: number;
      sequence: number;
      progress: SweepProgress;
    }
  | {
      type: 'point';
      sweepId: string;
      commandId: number;
      sequence: number;
      progress: SweepProgress;
      point: CompletedPoint;
    }
  | {
      type: 'terminal';
      sweepId: string;
      commandId: number;
      sequence: number;
      progress: SweepProgress;
      partial: { index: number; updates: number; measurements: number } | null;
      error: string | null;
    };
