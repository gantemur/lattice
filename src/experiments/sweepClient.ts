import type { SweepPlan } from './sweepPlan';
import type { SweepReply } from './sweepProtocol';

/** Rejects replies from superseded workers and out-of-order progress frames. */
export class SweepClient {
  private worker: Worker;
  private sweepId = '';
  private commandId = 0;
  private sequence = 0;
  private active = false;
  onReply: (reply: SweepReply) => void = () => {};
  onError: (message: string) => void = () => {};

  constructor(worker: Worker) {
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<SweepReply>) => {
      const reply = event.data;
      if (
        reply.sweepId !== this.sweepId ||
        reply.commandId > this.commandId ||
        reply.sequence <= this.sequence
      )
        return;
      this.sequence = reply.sequence;
      if (reply.type === 'terminal' || reply.type === 'error')
        this.active = false;
      this.onReply(reply);
    };
    worker.onerror = (event: ErrorEvent) => {
      this.active = false;
      this.onError(event.message || 'Sweep worker failed.');
    };
    worker.onmessageerror = () => {
      this.active = false;
      this.onError('Sweep worker sent an unreadable response.');
    };
  }
  start(plan: SweepPlan): string {
    if (this.active) throw new Error('A sweep is already active.');
    this.sweepId = crypto.randomUUID();
    this.sequence = 0;
    this.active = true;
    this.post({ type: 'start', sweepId: this.sweepId, plan });
    return this.sweepId;
  }
  command(type: 'pause' | 'resume' | 'cancel') {
    if (!this.active) throw new Error('No active sweep.');
    this.post({ type, sweepId: this.sweepId });
  }
  acknowledge(pointIndex: number) {
    if (!this.active) throw new Error('No active sweep.');
    this.post({ type: 'ack', sweepId: this.sweepId, pointIndex });
  }
  private post(
    command:
      | { type: 'start'; sweepId: string; plan: SweepPlan }
      | { type: 'pause' | 'resume' | 'cancel'; sweepId: string }
      | { type: 'ack'; sweepId: string; pointIndex: number },
  ) {
    this.worker.postMessage({ ...command, commandId: ++this.commandId });
  }
  dispose() {
    this.worker.terminate();
  }
}
