import { validateSeed } from '../algorithms/rng';
import { validateSettings } from '../algorithms/transitions';
import type { Settings } from '../algorithms/transitions';
import type {
  RunConfiguration,
  SmallCapture,
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
  private pendingSettings: Settings | null = null;
  private captureRequestId = 0;
  private pendingCapture: {
    id: number;
    version: number;
    resolve: (capture: SmallCapture) => void;
    reject: (reason: Error) => void;
  } | null = null;

  constructor(
    private readonly createWorker: () => WorkerPort,
    private readonly publish: (view: SimulationView) => void,
  ) {}

  initialize(configuration: RunConfiguration): void {
    validateSettings(configuration);
    validateSeed(configuration.seed);
    this.cancelTimer();
    this.rejectCapture('Session changed before capture completed.');
    this.pendingSettings = null;
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

  changeSettings(settings: Settings): void {
    validateSettings(settings);
    if (!this.worker || this.view.error || !this.view.snapshot)
      throw new Error('Wait for the worker, or Reset to recover it.');
    if (this.pendingCapture)
      throw new Error(
        'Wait for the read-only capture before applying parameters.',
      );
    this.cancelTimer();
    this.pendingSettings = structuredClone(settings);
    if (!this.view.busy) this.sendSettings();
  }

  private sendSettings(): void {
    const settings = this.pendingSettings!;
    this.pendingSettings = null;
    this.view.busy = true;
    this.emit();
    try {
      this.worker!.postMessage({
        type: 'changeSettings',
        runId: this.runId,
        settings,
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
  capture(segmentId: number): Promise<SmallCapture> {
    if (!this.ready() || this.view.running || this.pendingSettings)
      return Promise.reject(
        new Error('Pause and wait for the worker before saving.'),
      );
    const version = this.view.snapshot!.version;
    const id = ++this.captureRequestId;
    this.view.busy = true;
    this.emit();
    return new Promise((resolve, reject) => {
      this.pendingCapture = { id, version, resolve, reject };
      try {
        this.worker!.postMessage({
          type: 'capture',
          runId: this.runId,
          requestId: id,
          segmentId,
        });
      } catch {
        this.rejectCapture('Could not request a capture from the worker.');
        this.view.busy = false;
        this.emit();
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
    this.rejectCapture('Workspace closed before capture completed.');
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
    if (response.type === 'capture') {
      const pending = this.pendingCapture;
      if (
        !pending ||
        response.runId !== this.runId ||
        response.requestId !== pending.id
      )
        return;
      this.pendingCapture = null;
      this.view.busy = false;
      if (response.capture.version !== pending.version)
        pending.reject(
          new Error('Capture version changed; retry after Pausing.'),
        );
      else pending.resolve(response.capture);
      this.emit();
      return;
    }
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
    if (this.pendingSettings) {
      this.sendSettings();
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
    this.rejectCapture(message);
    this.worker?.terminate();
    this.worker = null;
    this.view = { ...this.view, error: message, running: false, busy: false };
    this.emit();
  }

  private cancelTimer(): void {
    clearTimeout(this.timer);
  }
  private rejectCapture(message: string): void {
    this.pendingCapture?.reject(new Error(message));
    this.pendingCapture = null;
  }
  private emit(): void {
    if (!this.disposed) this.publish({ ...this.view });
  }
}
