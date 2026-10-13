import { validateSeed } from '../algorithms/rng';
import { validateFieldSettings } from './fieldRun';
import type {
  FieldConfiguration,
  FieldRequest,
  FieldResponse,
  FieldSettings,
  FieldSnapshot,
} from './fieldRun';

export type FieldView = {
  snapshot: FieldSnapshot | null;
  running: boolean;
  busy: boolean;
  error: string | null;
};
export type FieldWorkerPort = {
  postMessage(request: FieldRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<FieldResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

/**
 * The client schedules at most one acknowledged batch. It owns no field or
 * RNG state; pause, plot selection and React rendering cannot draw randomness.
 */
export class FieldClient {
  private worker: FieldWorkerPort | null = null;
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingSettings: FieldSettings | null = null;
  private disposed = false;
  private view: FieldView = {
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  };
  constructor(
    private readonly makeWorker: () => FieldWorkerPort,
    private readonly publish: (view: FieldView) => void,
  ) {}
  private emit() {
    if (!this.disposed) this.publish({ ...this.view });
  }
  private cancelTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  initialize(configuration: FieldConfiguration) {
    validateFieldSettings(configuration);
    validateSeed(configuration.seed);
    this.cancelTimer();
    this.pendingSettings = null;
    this.runId++;
    this.view = { snapshot: null, running: false, busy: true, error: null };
    this.emit();
    if (!this.worker) {
      this.worker = this.makeWorker();
      this.worker.onmessage = ({ data }) => this.receive(data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        // A crashed worker cannot service Reset. Release it so initialize()
        // creates a fresh worker instead of posting into a dead port.
        this.worker?.terminate();
        this.worker = null;
        this.fail('Field worker stopped. Reset to restart.');
      };
    }
    this.worker.postMessage({
      type: 'initialize',
      runId: this.runId,
      configuration,
    });
  }
  private ready() {
    return (
      !this.disposed &&
      !!this.worker &&
      !!this.view.snapshot &&
      !this.view.busy &&
      !this.view.error
    );
  }
  start() {
    if (!this.ready() || this.view.running) return;
    this.view.running = true;
    this.advance(this.batchSize());
  }
  private batchSize() {
    const settings = this.view.snapshot?.segments.at(-1)?.settings;
    // HMC performs L full-path force evaluations per transition. Existing
    // samplers retain their original 128-update scheduling and RNG streams.
    return settings?.model === 'quartic-oscillator' &&
      settings.sampler.kind === 'hmc'
      ? 16
      : 128;
  }
  pause() {
    this.cancelTimer();
    this.view.running = false;
    // A posted batch still finishes before Step or a parameter change.
    this.emit();
  }
  step() {
    if (this.ready() && !this.view.running) this.advance(1);
  }
  change(settings: FieldSettings) {
    validateFieldSettings(settings);
    if (!this.worker || !this.view.snapshot || this.view.error)
      throw new Error('Wait for the worker or Reset.');
    this.cancelTimer();
    this.pendingSettings = structuredClone(settings);
    if (!this.view.busy) this.sendChange();
  }
  private sendChange() {
    const settings = this.pendingSettings!;
    this.pendingSettings = null;
    this.view.busy = true;
    this.emit();
    this.worker!.postMessage({ type: 'change', runId: this.runId, settings });
  }
  private advance(count: number) {
    this.view.busy = true;
    this.emit();
    this.worker!.postMessage({ type: 'advance', runId: this.runId, count });
  }
  private receive(response: FieldResponse) {
    if (this.disposed) return;
    if (response.type === 'error') {
      if (response.runId === this.runId) this.fail(response.message);
      return;
    }
    const snapshot = response.snapshot;
    if (
      snapshot.runId !== this.runId ||
      snapshot.version < (this.view.snapshot?.version ?? -1)
    )
      return;
    this.view = { ...this.view, snapshot, busy: false, error: null };
    this.emit();
    if (this.pendingSettings) this.sendChange();
    else if (this.view.running)
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.view.running && this.ready()) this.advance(this.batchSize());
      }, 16);
  }
  private fail(message: string) {
    this.cancelTimer();
    this.view = { ...this.view, running: false, busy: false, error: message };
    this.emit();
  }
  dispose() {
    this.disposed = true;
    this.cancelTimer();
    this.worker?.terminate();
    this.worker = null;
  }
}
