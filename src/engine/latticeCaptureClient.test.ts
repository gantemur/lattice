import { expect, it } from 'vitest';
import { LatticeClient } from './latticeClient';
import type { LatticeView, LatticeWorkerPort } from './latticeClient';
import { LatticeEngine, defaultLatticeConfiguration } from './latticeRun';
import type { LatticeRequest, LatticeResponse } from './latticeRun';

class FakeLatticeWorker implements LatticeWorkerPort {
  onmessage: LatticeWorkerPort['onmessage'] = null;
  onerror: LatticeWorkerPort['onerror'] = null;
  responses: LatticeResponse[] = [];
  engine = new LatticeEngine();
  postMessage(request: LatticeRequest) {
    this.responses.push(this.engine.handle(request));
  }
  terminate() {}
  deliver() {
    this.onmessage?.({
      data: this.responses.shift()!,
    } as MessageEvent<LatticeResponse>);
  }
}
it('lattice capture waits for acknowledged pause and copies without advancing its RNG', async () => {
  const worker = new FakeLatticeWorker();
  const state: { view: LatticeView | null } = { view: null };
  const client = new LatticeClient(
    () => worker,
    (next) => {
      state.view = next;
    },
  );
  client.initialize({
    ...defaultLatticeConfiguration,
    parameters: {
      ...defaultLatticeConfiguration.parameters,
      lx: 2,
      ly: 2,
    },
  });
  worker.deliver();
  client.start();
  client.pause();
  await expect(client.capture(1)).rejects.toThrow(/Pause/);
  worker.deliver();
  const before = structuredClone(state.view);
  const pending = client.capture(1);
  expect(() =>
    client.change({
      ...defaultLatticeConfiguration,
      parameters: {
        ...defaultLatticeConfiguration.parameters,
        lx: 2,
        ly: 2,
        field: 1,
      },
    }),
  ).toThrow(/capture/);
  worker.deliver();
  const capture = await pending;
  expect(capture.version).toBe(before!.snapshot!.version);
  expect(capture.segment.samples).toBe(before!.snapshot!.segments[0]!.samples);
  expect(state.view).toMatchObject(before!);
  client.dispose();
});
