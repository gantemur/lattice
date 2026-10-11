/// <reference lib="webworker" />
import { SweepRun } from '../experiments/sweepRun';
import type { SweepCommand, SweepReply } from '../experiments/sweepProtocol';

const context = self as DedicatedWorkerGlobalScope;
let run: SweepRun | null = null;
let sweepId = '';
let commandId = 0;
let sequence = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastProgressAt = 0;
let pendingPointIndex: number | null = null;
let terminalSent = false;
// A completed point blocks further pumping until its matching archive ACK.
// The worker can reach numerical completion before that final ACK arrives.

type WorkerPayload =
  | Pick<Extract<SweepReply, { type: 'state' }>, 'type' | 'progress'>
  | Pick<
      Extract<SweepReply, { type: 'command-error' }>,
      'type' | 'progress' | 'error'
    >
  | Pick<Extract<SweepReply, { type: 'point' }>, 'type' | 'progress' | 'point'>
  | Pick<
      Extract<SweepReply, { type: 'terminal' }>,
      'type' | 'progress' | 'partial' | 'error'
    >;
function emit(reply: WorkerPayload) {
  context.postMessage({ ...reply, sweepId, commandId, sequence: ++sequence });
}
function emitTerminal(
  partial: { index: number; updates: number; measurements: number } | null,
  error: string | null,
) {
  // One terminal reply per sweep; no later timer may resume sampling.
  if (!run || terminalSent) return;
  terminalSent = true;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  pendingPointIndex = null;
  emit({ type: 'terminal', progress: run.progress(), partial, error });
}
function schedule() {
  if (
    terminalSent ||
    timer !== null ||
    pendingPointIndex !== null ||
    run?.progress().status !== 'running'
  )
    return;
  timer = setTimeout(pump, 0);
}
function pump() {
  timer = null;
  if (
    terminalSent ||
    pendingPointIndex !== null ||
    !run ||
    run.progress().status !== 'running'
  )
    return;
  try {
    const point = run.advance(4096);
    if (point) {
      pendingPointIndex = point.index;
      emit({ type: 'point', progress: run.progress(), point });
      return;
    }
    const progress = run.progress();
    if (progress.status === 'completed') {
      emitTerminal(null, null);
      return;
    }
    const now = Date.now();
    if (point || now - lastProgressAt >= 80) {
      emit({ type: 'state', progress });
      lastProgressAt = now;
    }
    schedule();
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'Sweep worker failed.';
    const partial = run.progress().status === 'completed' ? null : run.cancel();
    emitTerminal(partial, message);
  }
}
context.onmessage = ({ data }: MessageEvent<SweepCommand>) => {
  if (!Number.isSafeInteger(data.commandId) || data.commandId < 1) return;
  if (data.type === 'start') {
    if (run && (data.sweepId === sweepId || data.commandId <= commandId))
      return;
    if (
      run &&
      (!terminalSent || pendingPointIndex !== null) &&
      ['running', 'paused', 'completed'].includes(run.progress().status)
    )
      return;
    try {
      run = new SweepRun(data.plan);
      run.start();
      sweepId = data.sweepId;
      commandId = data.commandId;
      sequence = 0;
      lastProgressAt = 0;
      pendingPointIndex = null;
      terminalSent = false;
      emit({ type: 'state', progress: run.progress() });
      schedule();
    } catch (cause) {
      sweepId = data.sweepId;
      commandId = data.commandId;
      sequence = 0;
      const message =
        cause instanceof Error ? cause.message : 'Invalid sweep plan.';
      context.postMessage({
        type: 'error',
        sweepId,
        commandId,
        sequence: ++sequence,
        error: message,
      });
    }
    return;
  }
  if (!run || data.sweepId !== sweepId || data.commandId <= commandId) return;
  if (terminalSent) return;
  commandId = data.commandId;
  try {
    if (data.type === 'ack') {
      // Stale/duplicate ACKs are inert, including after a later point stages.
      if (data.pointIndex !== pendingPointIndex) return;
      pendingPointIndex = null;
      const progress = run.progress();
      if (progress.status === 'completed') emitTerminal(null, null);
      else schedule();
      return;
    }
    if (data.type === 'pause') run.pause();
    else if (data.type === 'resume') run.resume();
    else {
      const partial =
        run.progress().status === 'completed' ? null : run.cancel();
      emitTerminal(partial, null);
      return;
    }
    emit({ type: 'state', progress: run.progress() });
    schedule();
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'Sweep command failed.';
    emit({ type: 'command-error', progress: run.progress(), error: message });
  }
};
