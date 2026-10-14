import { validateSeed } from '../algorithms/rng';
import { sameXYSupport, validateXYSettings } from './xyRun';
import type {
  XYConfiguration,
  XYSettings,
  XYSnapshot,
  XYRequest,
  XYResponse,
} from './xyRun';
export type XYPort = {
  postMessage(request: XYRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<XYResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
export type XYView = {
  snapshot: XYSnapshot | null;
  running: boolean;
  busy: boolean;
  pending: boolean;
  error: string | null;
};
/** Separate clients may mount in Small/Lattice Systems; each owns exactly one
 * worker and in-flight batch. Parameter Apply queues behind its acknowledgment.
 * This is XY-only scheduling, with no changes to released engine protocols. */
export class XYClient {
  private worker: XYPort | null = null;
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private pending: XYSettings | null = null;
  private view: XYView = {
    snapshot: null,
    running: false,
    busy: false,
    pending: false,
    error: null,
  };
  constructor(
    private readonly makeWorker: () => XYPort,
    private readonly publish: (view: XYView) => void,
  ) {}
  private emit() {
    if (!this.disposed) this.publish({ ...this.view });
  }
  private cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  initialize(configuration: XYConfiguration) {
    validateXYSettings(configuration);
    validateSeed(configuration.seed);
    this.cancel();
    this.pending = null;
    this.runId++;
    this.view = {
      snapshot: null,
      running: false,
      busy: true,
      pending: false,
      error: null,
    };
    this.emit();
    if (!this.worker) {
      this.worker = this.makeWorker();
      this.worker.onmessage = ({ data }) => this.receive(data);
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.worker?.terminate();
        this.worker = null;
        this.cancel();
        this.pending = null;
        this.view = {
          ...this.view,
          running: false,
          busy: false,
          pending: false,
          error: 'XY worker stopped. Reset to restart.',
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
      !this.view.error &&
      !this.pending
    );
  }
  private send(
    command:
      | { type: 'advance'; count: number }
      | { type: 'change'; settings: XYSettings }
      | { type: 'global-rotation'; alpha: number },
  ) {
    this.view.busy = true;
    this.emit();
    this.worker!.postMessage({
      ...command,
      runId: this.runId,
      version: this.view.snapshot!.version,
    });
  }
  change(settings: XYSettings) {
    validateXYSettings(settings);
    if (!this.worker || !this.view.snapshot || this.view.error)
      throw new Error('Wait for the worker or Reset.');
    if (
      !sameXYSupport(
        settings.parameters,
        this.view.snapshot.configuration.parameters,
      ) ||
      settings.initialization !==
        this.view.snapshot.configuration.initialization
    )
      throw new Error('Support changes require a new session.');
    this.cancel();
    this.pending = structuredClone(settings);
    this.view.pending = true;
    this.emit();
    if (!this.view.busy) this.sendChange();
  }
  private sendChange() {
    const settings = this.pending!;
    this.pending = null;
    this.view.pending = false;
    this.send({ type: 'change', settings });
  }
  private batch() {
    // Both algorithms count site attempts; rejection heat bath has variable
    // internal work. Conservative batches bound acknowledgment latency.
    const size = this.view.snapshot!.angles.length;
    this.send({ type: 'advance', count: size > 8 ? 512 : 128 });
  }
  rotate(alpha: number) {
    if (!this.ready() || this.view.running)
      throw new Error('Pause and wait for the batch acknowledgment.');
    if (this.view.snapshot!.configuration.parameters.h !== 0)
      throw new Error('Global rotation is a symmetry only at h=0.');
    if (!Number.isFinite(alpha) || Math.abs(alpha) > 1e6)
      throw new Error('Use a finite rotation |α|≤10⁶ radians.');
    this.send({ type: 'global-rotation', alpha });
  }
  start() {
    if (this.ready() && !this.view.running) {
      this.view.running = true;
      this.batch();
    }
  }
  pause() {
    this.cancel();
    this.view.running = false;
    this.emit();
  }
  step() {
    if (!this.ready() || this.view.running)
      throw new Error('Pause and wait for the batch acknowledgment.');
    this.send({ type: 'advance', count: 1 });
  }
  private receive(response: XYResponse) {
    if (this.disposed) return;
    if (response.type === 'error') {
      if (response.runId !== this.runId) return;
      this.cancel();
      this.pending = null;
      this.view = {
        ...this.view,
        running: false,
        busy: false,
        pending: false,
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
    if (this.pending) {
      this.sendChange();
      return;
    }
    if (this.view.running)
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.ready() && this.view.running) this.batch();
      }, 16);
  }
  dispose() {
    this.disposed = true;
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }
}
