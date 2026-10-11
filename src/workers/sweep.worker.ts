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
let awaitingPointAck = false;

type WorkerPayload =
  | Pick<Extract<SweepReply, { type: 'state' }>, 'type' | 'progress'>
  | Pick<Extract<SweepReply, { type: 'point' }>, 'type' | 'progress' | 'point'>
  | Pick<
      Extract<SweepReply, { type: 'terminal' }>,
      'type' | 'progress' | 'partial' | 'error'
    >;
function emit(reply: WorkerPayload) {
  context.postMessage({ ...reply, sweepId, commandId, sequence: ++sequence });
}
function schedule() {
  if (
    timer !== null ||
    awaitingPointAck ||
    run?.progress().status !== 'running'
  )
    return;
  timer = setTimeout(pump, 0);
}
function pump() {
  timer = null;
  if (!run || run.progress().status !== 'running') return;
  try {
    const point = run.advance(4096);
    if (point) {
      awaitingPointAck = true;
      emit({ type: 'point', progress: run.progress(), point });
      return;
    }
    const progress = run.progress();
    if (progress.status === 'completed') {
      emit({ type: 'terminal', progress, partial: null, error: null });
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
    const partial = run.cancel();
    emit({
      type: 'terminal',
      progress: run.progress(),
      partial,
      error: message,
    });
  }
}
context.onmessage = ({ data }: MessageEvent<SweepCommand>) => {
  if (!Number.isSafeInteger(data.commandId) || data.commandId < 1) return;
  if (data.type === 'start') {
    if (run && ['running', 'paused'].includes(run.progress().status)) return;
    try {
      run = new SweepRun(data.plan);
      run.start();
      sweepId = data.sweepId;
      commandId = data.commandId;
      sequence = 0;
      lastProgressAt = 0;
      awaitingPointAck = false;
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
  commandId = data.commandId;
  try {
    if (data.type === 'ack') {
      if (!awaitingPointAck)
        throw new Error('No completed point awaits archival.');
      awaitingPointAck = false;
      const progress = run.progress();
      if (progress.status === 'completed')
        emit({ type: 'terminal', progress, partial: null, error: null });
      else schedule();
      return;
    }
    if (data.type === 'pause') run.pause();
    else if (data.type === 'resume') run.resume();
    else {
      const partial =
        run.progress().status === 'completed' ? null : run.cancel();
      emit({
        type: 'terminal',
        progress: run.progress(),
        partial,
        error: null,
      });
      return;
    }
    emit({ type: 'state', progress: run.progress() });
    schedule();
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'Sweep command failed.';
    emit({
      type: 'terminal',
      progress: run.progress(),
      partial: null,
      error: message,
    });
  }
};
