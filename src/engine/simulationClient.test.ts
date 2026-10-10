import { afterEach, describe, expect, it, vi } from 'vitest';
import { GaussianEngine } from './gaussianEngine';
import { standardGaussianPreset } from './preset';
import type { WorkerRequest, WorkerResponse } from './protocol';
import { SimulationClient } from './simulationClient';
import type { SimulationView, WorkerPort } from './simulationClient';

class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null;
  onerror: WorkerPort['onerror'] = null;
  onmessageerror: WorkerPort['onmessageerror'] = null;
  terminated = false;
  responses: WorkerResponse[] = [];
  private engine = new GaussianEngine();
  postMessage(request: WorkerRequest) {
    this.responses.push(this.engine.handle(request));
  }
  terminate() {
    this.terminated = true;
  }
  deliver() {
    this.onmessage?.({
      data: this.responses.shift()!,
    } as MessageEvent<WorkerResponse>);
  }
}

function setup() {
  const worker = new FakeWorker();
  let latest: SimulationView;
  const client = new SimulationClient(
    () => worker,
    (view) => {
      latest = view;
    },
  );
  client.initialize(standardGaussianPreset.configuration);
  worker.deliver();
  return { worker, client, view: () => latest };
}

afterEach(() => vi.useRealTimers());
describe('client scheduling and acknowledgment', () => {
  it('pauses at the last posted batch and prevents Step until its acknowledgment', () => {
    vi.useFakeTimers();
    const { client, worker, view } = setup();
    client.start();
    client.start();
    expect(worker.responses).toHaveLength(1);
    client.pause();
    client.step();
    expect(worker.responses).toHaveLength(1);
    expect(view().busy).toBe(true);
    worker.deliver();
    vi.advanceTimersByTime(1000);
    expect(worker.responses).toHaveLength(0);
    expect(view()).toMatchObject({
      running: false,
      busy: false,
      snapshot: { updates: 128 },
    });
    client.step();
    worker.deliver();
    expect(view().snapshot?.updates).toBe(129);
    client.dispose();
  });
  it('ignores old-run and regressing responses when reset overlaps an in-flight batch', () => {
    const { client, worker, view } = setup();
    client.step();
    client.initialize(standardGaussianPreset.configuration);
    worker.deliver();
    expect(view().snapshot).toBeNull();
    worker.deliver();
    const initial = view().snapshot!;
    expect(initial.runId).toBe(2);
    client.step();
    worker.deliver();
    worker.onmessage?.({
      data: { type: 'snapshot', snapshot: initial },
    } as MessageEvent<WorkerResponse>);
    expect(view().snapshot?.updates).toBe(1);
    client.dispose();
  });
  it('retains the last confirmed state and stops on worker failure', () => {
    const { client, worker, view } = setup();
    client.step();
    worker.deliver();
    worker.onmessageerror?.();
    expect(worker.terminated).toBe(true);
    expect(view()).toMatchObject({
      running: false,
      busy: false,
      snapshot: { updates: 1 },
    });
    expect(view().error).toMatch(/Reset/);
    client.step();
    client.start();
    expect(worker.responses).toHaveLength(0);
    client.dispose();
  });
  it('can recreate a failed worker and reset from the same seed', () => {
    const workers: FakeWorker[] = [];
    const client = new SimulationClient(
      () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      () => {},
    );
    client.initialize(standardGaussianPreset.configuration);
    workers[0]!.deliver();
    workers[0]!.onmessageerror?.();
    client.initialize(standardGaussianPreset.configuration);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.responses[0]).toMatchObject({
      type: 'snapshot',
      snapshot: { runId: 2, updates: 0 },
    });
    client.dispose();
  });
});
