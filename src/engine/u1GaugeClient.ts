import { validateSeed } from '../algorithms/rng';
import { validateU1Settings } from './u1GaugeRun';
import type {
  U1Configuration,
  U1Request,
  U1Response,
  U1Settings,
  U1Snapshot,
} from './u1GaugeRun';
export type U1Port = {
  postMessage(request: U1Request): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<U1Response>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
export type U1View = {
  snapshot: U1Snapshot | null;
  running: boolean;
  busy: boolean;
  error: string | null;
};
/** The client schedules one batch at a time; pause waits for its acknowledgment.
 * Deterministic transformations are deliberately unavailable while running/busy. */
export class U1GaugeClient {
  private worker: U1Port | null = null;
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private view: U1View = {
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  };
  constructor(
    private readonly makeWorker: () => U1Port,
    private readonly publish: (view: U1View) => void,
  ) {}
  private emit() {
    if (!this.disposed) this.publish({ ...this.view });
  }
  private cancelTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  initialize(configuration: U1Configuration) {
    validateU1Settings(configuration);
    validateSeed(configuration.seed);
    this.cancelTimer();
    this.runId++;
    this.view = { snapshot: null, running: false, busy: true, error: null };
    this.emit();
    if (!this.worker) {
      this.worker = this.makeWorker();
      this.worker.onmessage = ({ data }) => this.receive(data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.worker?.terminate();
        this.worker = null;
        this.cancelTimer();
        this.view = {
          ...this.view,
          running: false,
          busy: false,
          error: 'U(1) worker stopped. Reset to restart.',
        };
        this.emit();
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
  private paused() {
    if (!this.ready() || this.view.running)
      throw new Error('Pause and wait for the current batch acknowledgment.');
  }
  private send(
    command:
      | { type: 'advance'; count: number }
      | { type: 'change'; settings: U1Settings }
      | { type: 'gauge-transform'; vertex: string; alpha: number },
  ) {
    this.view.busy = true;
    this.emit();
    this.worker!.postMessage({
      ...command,
      runId: this.runId,
      version: this.view.snapshot!.version,
    });
  }
  start() {
    if (this.ready() && !this.view.running) {
      this.view.running = true;
      this.send({ type: 'advance', count: 128 });
    }
  }
  pause() {
    this.cancelTimer();
    this.view.running = false;
    this.emit();
  }
  step() {
    this.paused();
    this.send({ type: 'advance', count: 1 });
  }
  change(settings: U1Settings) {
    this.paused();
    validateU1Settings(settings);
    this.send({ type: 'change', settings });
  }
  transform(vertex: string, alpha: number) {
    this.paused();
    this.send({ type: 'gauge-transform', vertex, alpha });
  }
  private receive(response: U1Response) {
    if (this.disposed) return;
    if (response.type === 'error') {
      if (response.runId !== this.runId) return;
      this.cancelTimer();
      this.view = {
        ...this.view,
        running: false,
        busy: false,
        error: response.message,
      };
      this.emit();
      return;
    }
    if (
      response.snapshot.runId !== this.runId ||
      response.snapshot.version <= (this.view.snapshot?.version ?? -1)
    )
      return;
    this.view = {
      ...this.view,
      snapshot: response.snapshot,
      busy: false,
      error: null,
    };
    this.emit();
    if (this.view.running)
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.ready() && this.view.running)
          this.send({ type: 'advance', count: 128 });
      }, 16);
  }
  dispose() {
    this.disposed = true;
    this.cancelTimer();
    this.worker?.terminate();
    this.worker = null;
  }
}
