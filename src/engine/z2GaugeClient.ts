import { validateSeed } from '../algorithms/rng';
import { validateGaugeSettings } from './z2GaugeRun';
import type {
  GaugeConfiguration,
  GaugeRequest,
  GaugeResponse,
  GaugeSettings,
  GaugeSnapshot,
} from './z2GaugeRun';
export type GaugePort = {
  postMessage(request: GaugeRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<GaugeResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
export type GaugeView = {
  snapshot: GaugeSnapshot | null;
  running: boolean;
  busy: boolean;
  error: string | null;
};
/** The client schedules one batch at a time; pause waits for its acknowledgment.
 * Deterministic transformations are deliberately unavailable while running/busy. */
export class GaugeClient {
  private worker: GaugePort | null = null;
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private view: GaugeView = {
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  };
  constructor(
    private readonly makeWorker: () => GaugePort,
    private readonly publish: (view: GaugeView) => void,
  ) {}
  private emit() {
    if (!this.disposed) this.publish({ ...this.view });
  }
  private cancelTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  initialize(configuration: GaugeConfiguration) {
    validateGaugeSettings(configuration);
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
          error: 'Gauge worker stopped. Reset to restart.',
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
      | { type: 'change'; settings: GaugeSettings }
      | { type: 'gauge-transform'; vertex: string },
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
  change(settings: GaugeSettings) {
    this.paused();
    validateGaugeSettings(settings);
    this.send({ type: 'change', settings });
  }
  transform(vertex: string) {
    this.paused();
    this.send({ type: 'gauge-transform', vertex });
  }
  private receive(response: GaugeResponse) {
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
