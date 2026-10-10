import { validateSeed } from '../algorithms/rng';
import { validateGaussian } from '../models/gaussian';
import type { GaussianParameters } from '../models/gaussian';
import type {
  RunConfiguration,
  Snapshot,
  WorkerRequest,
  WorkerResponse,
} from './protocol';

export type SimulationView = {
  snapshot: Snapshot | null;
  running: boolean;
  busy: boolean;
  error: string | null;
};

export interface WorkerPort {
  postMessage(request: WorkerRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: (() => void) | null;
}

export const emptySimulationView: SimulationView = {
  snapshot: null,
  running: false,
  busy: false,
  error: null,
};

/** Schedules at most one batch at a time; never owns or draws numerical state. */
export class SimulationClient {
  private view = { ...emptySimulationView };
  private worker: WorkerPort | null = null;
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private pendingParameters: GaussianParameters | null = null;

  constructor(
    private readonly createWorker: () => WorkerPort,
    private readonly publish: (view: SimulationView) => void,
  ) {}

  initialize(configuration: RunConfiguration): void {
    validateGaussian(configuration.parameters);
    validateSeed(configuration.seed);
    this.cancelTimer();
    this.pendingParameters = null;
    this.runId += 1;
    this.view = { snapshot: null, running: false, busy: true, error: null };
    this.emit();
    try {
      if (!this.worker) {
        this.worker = this.createWorker();
        this.worker.onmessage = ({ data }) => this.receive(data);
        this.worker.onerror = (event) => {
          event.preventDefault();
          this.fail('The sampling worker stopped. Reset to restart it.');
        };
        this.worker.onmessageerror = () =>
          this.fail('Could not read the worker response. Reset to restart it.');
      }
      this.worker.postMessage({
        type: 'initialize',
        runId: this.runId,
        configuration,
      });
    } catch {
      this.fail('Could not start the sampling worker. Reset to try again.');
    }
  }

  start(): void {
    if (!this.ready() || this.view.running) return;
    this.view.running = true;
    this.advance(128);
  }

  changeParameters(parameters: GaussianParameters): void {
    validateGaussian(parameters);
    if (!this.worker || this.view.error || !this.view.snapshot)
      throw new Error('Wait for the worker, or Reset to recover it.');
    this.cancelTimer();
    this.pendingParameters = { ...parameters };
    if (!this.view.busy) this.sendParameters();
  }

  private sendParameters(): void {
    const parameters = this.pendingParameters!;
    this.pendingParameters = null;
    this.view.busy = true;
    this.emit();
    try {
      this.worker!.postMessage({
        type: 'changeParameters',
        runId: this.runId,
        parameters,
      });
    } catch {
      this.fail('Could not apply parameters. Reset to restart the worker.');
    }
  }

  pause(): void {
    this.cancelTimer();
    this.view.running = false;
    // An already posted batch is acknowledged before Step is re-enabled.
    this.emit();
  }

  step(): void {
    if (this.ready() && !this.view.running) this.advance(1);
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
    this.worker?.terminate();
    this.worker = null;
  }

  private ready(): boolean {
    return (
      !this.disposed &&
      !!this.worker &&
      !!this.view.snapshot &&
      !this.view.busy &&
      !this.view.error
    );
  }

  private advance(count: number): void {
    this.view.busy = true;
    this.emit();
    try {
      this.worker!.postMessage({ type: 'advance', runId: this.runId, count });
    } catch {
      this.fail('Could not send an update to the worker. Reset to restart it.');
    }
  }

  private receive(response: WorkerResponse): void {
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
    this.view.snapshot = snapshot;
    this.view.busy = false;
    if (this.pendingParameters) {
      this.sendParameters();
      return;
    }
    this.emit();
    if (this.view.running) {
      this.cancelTimer();
      this.timer = setTimeout(() => {
        if (this.view.running && this.ready()) this.advance(128);
      }, 100);
    }
  }

  private fail(message: string): void {
    this.cancelTimer();
    this.worker?.terminate();
    this.worker = null;
    this.view = { ...this.view, error: message, running: false, busy: false };
    this.emit();
  }

  private cancelTimer(): void {
    clearTimeout(this.timer);
  }
  private emit(): void {
    if (!this.disposed) this.publish({ ...this.view });
  }
}
