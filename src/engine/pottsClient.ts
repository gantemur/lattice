import { validateSeed } from '../algorithms/rng';
import { samePottsSupport, validatePottsSettings } from './pottsRun';
import type {
  PottsConfiguration,
  PottsSettings,
  PottsSnapshot,
  PottsRequest,
  PottsResponse,
} from './pottsRun';
export type PottsPort = {
  postMessage(request: PottsRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<PottsResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};
export type PottsView = {
  snapshot: PottsSnapshot | null;
  running: boolean;
  busy: boolean;
  pending: boolean;
  error: string | null;
};
/** Separate clients may mount in Small/Lattice Systems; each owns exactly one
 * worker and in-flight batch. Parameter Apply queues behind its acknowledgment.
 * This is Potts-only scheduling, with no changes to released engine protocols. */
export class PottsClient {
  private worker: PottsPort | null = null;
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private pending: PottsSettings | null = null;
  private view: PottsView = {
    snapshot: null,
    running: false,
    busy: false,
    pending: false,
    error: null,
  };
  constructor(
    private readonly makeWorker: () => PottsPort,
    private readonly publish: (view: PottsView) => void,
  ) {}
  private emit() {
    if (!this.disposed) this.publish({ ...this.view });
  }
  private cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  initialize(configuration: PottsConfiguration) {
    validatePottsSettings(configuration);
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
          error: 'Potts worker stopped. Reset to restart.',
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
      | { type: 'change'; settings: PottsSettings },
  ) {
    this.view.busy = true;
    this.emit();
    this.worker!.postMessage({
      ...command,
      runId: this.runId,
      version: this.view.snapshot!.version,
    });
  }
  change(settings: PottsSettings) {
    validatePottsSettings(settings);
    if (!this.worker || !this.view.snapshot || this.view.error)
      throw new Error('Wait for the worker or Reset.');
    if (
      !samePottsSupport(
        settings.parameters,
        this.view.snapshot.configuration.parameters,
      )
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
    // Fixed bounded policy, measured on both local algorithms at 32×32.
    // Tiny direct/state inspections use 128; rectangles use 1024 attempts.
    const size = this.view.snapshot!.colors.length;
    const cluster = ['sw', 'fk-direct'].includes(
      this.view.snapshot!.configuration.sampler,
    );
    this.send({ type: 'advance', count: cluster ? 8 : size > 8 ? 1024 : 128 });
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
  private receive(response: PottsResponse) {
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
