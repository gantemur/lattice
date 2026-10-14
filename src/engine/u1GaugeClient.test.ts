import { expect, it } from 'vitest';
import { U1GaugeClient } from './u1GaugeClient';
import type { U1Port, U1View } from './u1GaugeClient';
import { U1GaugeEngine, U1GaugeRun, defaultU1 } from './u1GaugeRun';
import type { U1Request, U1Response } from './u1GaugeRun';
class Port implements U1Port {
  onmessage: ((event: MessageEvent<U1Response>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  queue: U1Request[] = [];
  engine = new U1GaugeEngine();
  terminated = false;
  postMessage(r: U1Request) {
    this.queue.push(r);
  }
  flush() {
    const r = this.queue.shift()!;
    this.onmessage?.({
      data: this.engine.handle(r),
    } as MessageEvent<U1Response>);
  }
  terminate() {
    this.terminated = true;
  }
}
it('busy/paused transformation gate, one batch, Reset and stale replies', () => {
  const port = new Port(),
    state: { view: U1View | null } = { view: null };
  const client = new U1GaugeClient(
    () => port,
    (v) => (state.view = v),
  );
  client.initialize(defaultU1);
  expect(() => client.transform('v0', 1.23)).toThrow();
  port.flush();
  client.start();
  client.start();
  expect(port.queue).toHaveLength(1);
  expect(() => client.transform('v0', 1.23)).toThrow();
  client.pause();
  expect(() => client.transform('v0', 1.23)).toThrow();
  port.flush();
  const before = state.view!.snapshot!;
  client.transform('v0', 1.23);
  expect(port.queue[0]).toEqual({
    type: 'gauge-transform',
    vertex: 'v0',
    alpha: 1.23,
    runId: 1,
    version: before.version,
  });
  port.flush();
  expect(state.view!.snapshot!.draws).toBe(384);
  expect(state.view!.snapshot!.segments).toEqual(before.segments);
  client.step();
  port.flush();
  expect(state.view!.snapshot!.updates).toBe(129);
  client.initialize(defaultU1);
  port.flush();
  client.step();
  port.flush();
  const control = new U1GaugeRun(defaultU1, 2);
  control.advance(1);
  expect(state.view!.snapshot).toEqual(control.snapshot());
  port.onmessage?.({
    data: { type: 'snapshot', snapshot: before },
  } as MessageEvent<U1Response>);
  expect(state.view!.snapshot).toEqual(control.snapshot());
  client.dispose();
  expect(port.terminated).toBe(true);
});
