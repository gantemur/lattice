import { expect, it } from 'vitest';
import { GaugeClient } from './z2GaugeClient';
import type { GaugePort, GaugeView } from './z2GaugeClient';
import { GaugeEngine, GaugeRun, defaultGauge } from './z2GaugeRun';
import type { GaugeRequest, GaugeResponse } from './z2GaugeRun';
class Port implements GaugePort {
  onmessage: ((event: MessageEvent<GaugeResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  queue: GaugeRequest[] = [];
  engine = new GaugeEngine();
  terminated = false;
  postMessage(r: GaugeRequest) {
    this.queue.push(r);
  }
  flush() {
    const r = this.queue.shift()!;
    this.onmessage?.({
      data: this.engine.handle(r),
    } as MessageEvent<GaugeResponse>);
  }
  terminate() {
    this.terminated = true;
  }
}
it('busy/paused transformation gate, one batch, Reset and stale replies', () => {
  const port = new Port(),
    state: { view: GaugeView | null } = { view: null };
  const client = new GaugeClient(
    () => port,
    (v) => (state.view = v),
  );
  client.initialize(defaultGauge);
  expect(() => client.transform('v0')).toThrow();
  port.flush();
  client.start();
  client.start();
  expect(port.queue).toHaveLength(1);
  expect(() => client.transform('v0')).toThrow();
  client.pause();
  expect(() => client.transform('v0')).toThrow();
  port.flush();
  const before = state.view!.snapshot!;
  client.transform('v0');
  expect(port.queue[0]).toEqual({
    type: 'gauge-transform',
    vertex: 'v0',
    runId: 1,
    version: before.version,
  });
  port.flush();
  expect(state.view!.snapshot!.draws).toBe(128);
  expect(state.view!.snapshot!.segments).toEqual(before.segments);
  client.step();
  port.flush();
  expect(state.view!.snapshot!.updates).toBe(129);
  client.initialize(defaultGauge);
  port.flush();
  client.step();
  port.flush();
  const control = new GaugeRun(defaultGauge, 2);
  control.advance(1);
  expect(state.view!.snapshot).toEqual(control.snapshot());
  port.onmessage?.({
    data: { type: 'snapshot', snapshot: before },
  } as MessageEvent<GaugeResponse>);
  expect(state.view!.snapshot).toEqual(control.snapshot());
  client.dispose();
  expect(port.terminated).toBe(true);
});
