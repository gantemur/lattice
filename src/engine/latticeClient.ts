import type {
  LatticeConfiguration,
  LatticeCapture,
  LatticeRequest,
  LatticeResponse,
  LatticeSettings,
  LatticeSnapshot,
} from './latticeRun';
import { validateLatticeSettings } from './latticeRun';
import { validateSeed } from '../algorithms/rng';
export type LatticeView = {
  snapshot: LatticeSnapshot | null;
  running: boolean;
  busy: boolean;
  error: string | null;
};
export type LatticeWorkerPort = {
  postMessage(request: LatticeRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<LatticeResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
/** One bounded worker batch in flight; UI and plotting never touch the RNG. */
export class LatticeClient {
  private worker: LatticeWorkerPort | null = null;
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: LatticeSettings | null = null;
  private disposed = false;
  private captureRequestId = 0;
  private pendingCapture: {
    id: number;
    version: number;
    resolve: (capture: LatticeCapture) => void;
    reject: (reason: Error) => void;
  } | null = null;
  private view: LatticeView = {
    snapshot: null,
    running: false,
    busy: false,
    error: null,
  };
  constructor(
    private readonly createWorker: () => LatticeWorkerPort,
    private readonly publish: (view: LatticeView) => void,
  ) {}
  private emit() {
    if (!this.disposed) this.publish({ ...this.view });
  }
  private cancel() {
    clearTimeout(this.timer);
  }
  initialize(configuration: LatticeConfiguration) {
    validateLatticeSettings(configuration);
    validateSeed(configuration.seed);
    this.cancel();
    this.rejectCapture('Session changed before capture completed.');
    this.pending = null;
    this.runId++;
    this.view = { snapshot: null, running: false, busy: true, error: null };
    this.emit();
    if (!this.worker) {
      this.worker = this.createWorker();
      this.worker.onmessage = ({ data }) => this.receive(data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.fail('Lattice worker stopped. Reset to restart.');
      };
    }
    this.worker.postMessage({
      type: 'initialize',
      runId: this.runId,
      configuration,
    });
  }
  change(settings: LatticeSettings) {
    validateLatticeSettings(settings);
    if (!this.worker || !this.view.snapshot || this.view.error)
      throw new Error('Wait for worker or Reset.');
    if (this.pendingCapture)
      throw new Error(
        'Wait for the read-only capture before applying parameters.',
      );
    this.cancel();
    // Defer until any posted batch completes so one batch has one parameter
    // set, regardless of when the user edits the form.
    this.pending = structuredClone(settings);
    if (!this.view.busy) this.sendChange();
  }
  private sendChange() {
    const settings = this.pending!;
    this.pending = null;
    this.view.busy = true;
    this.emit();
    this.worker!.postMessage({ type: 'change', runId: this.runId, settings });
  }
  start() {
    if (this.ready() && !this.view.running) {
      this.view.running = true;
      this.advance(4096);
    }
  }
  pause() {
    this.cancel();
    this.view.running = false;
    this.emit();
  }
  step() {
    if (this.ready() && !this.view.running) this.advance(1);
  }
  capture(segmentId: number): Promise<LatticeCapture> {
    if (!this.ready() || this.view.running || this.pending)
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
        this.rejectCapture('Could not request a lattice capture.');
        this.view.busy = false;
        this.emit();
      }
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
  private advance(count: number) {
    this.view.busy = true;
    this.emit();
    this.worker!.postMessage({ type: 'advance', runId: this.runId, count });
  }
  private receive(response: LatticeResponse) {
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
    if (
      response.snapshot.runId !== this.runId ||
      response.snapshot.version < (this.view.snapshot?.version ?? -1)
    )
      return;
    this.view.snapshot = response.snapshot;
    this.view.busy = false;
    if (this.pending) {
      this.sendChange();
      return;
    }
    this.emit();
    if (this.view.running) {
      this.cancel();
      this.timer = setTimeout(() => {
        if (this.ready() && this.view.running) this.advance(4096);
      }, 40);
    }
  }
  private fail(message: string) {
    this.cancel();
    this.rejectCapture(message);
    this.worker?.terminate();
    this.worker = null;
    this.view = { ...this.view, running: false, busy: false, error: message };
    this.emit();
  }
  dispose() {
    this.disposed = true;
    this.cancel();
    this.rejectCapture('Workspace closed before capture completed.');
    this.worker?.terminate();
    this.worker = null;
  }
  private rejectCapture(message: string) {
    this.pendingCapture?.reject(new Error(message));
    this.pendingCapture = null;
  }
}
