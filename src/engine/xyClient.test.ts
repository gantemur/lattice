import { expect, it, vi } from 'vitest';
import { XYClient } from './xyClient';
import type { XYPort, XYView } from './xyClient';
import { XYEngine, defaultSmallXY } from './xyRun';
import type { XYRequest, XYResponse } from './xyRun';
it('actual handler behind client: queued Apply, repeated controls, pause acknowledgment and reset/stale replies', () => {
  vi.useFakeTimers();
  try {
    const requests: XYRequest[] = [],
      engine = new XYEngine();
    let view: XYView | null = null;
    const port: XYPort = {
      postMessage: (r) => requests.push(r),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
    const client = new XYClient(
      () => port,
      (v) => {
        view = v;
      },
    );
    const current = () => view!;
    const deliver = (reply: XYResponse) =>
      port.onmessage!({ data: reply } as MessageEvent<XYResponse>);
    const flush = () => {
      const request = requests.shift()!;
      const reply = engine.handle(request);
      deliver(reply);
      return reply;
    };
    client.initialize({ ...defaultSmallXY, warmup: 0 });
    expect(current().busy).toBe(true);
    flush();
    client.start();
    client.start();
    expect(() => client.rotate(0.2)).toThrow();
    expect(requests).toHaveLength(1);
    expect(() => client.step()).toThrow();
    client.change({
      ...defaultSmallXY,
      parameters: { ...defaultSmallXY.parameters, h: -0.4 },
    });
    expect(current().pending).toBe(true);
    expect(requests).toHaveLength(1);
    client.pause();
    client.pause();
    expect(current().busy).toBe(true);
    const old = flush();
    expect(requests[0]!.type).toBe('change');
    expect(current().snapshot!.segments).toHaveLength(1);
    flush();
    expect(current().snapshot!.segments).toHaveLength(2);
    expect(current().snapshot!.segments[0]!.samples).toBe(128);
    expect(current().snapshot!.segments[1]!.samples).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(requests).toHaveLength(0);
    expect(current().running).toBe(false);
    expect(() => client.rotate(0.2)).toThrow(/h=0/);
    client.step();
    flush();
    expect(current().snapshot!.updates).toBe(129);
    client.start();
    client.initialize({ ...defaultSmallXY, warmup: 0 });
    const delayed = engine.handle(requests.shift()!);
    flush();
    expect(current().snapshot!.updates).toBe(0);
    deliver(delayed);
    deliver(old);
    expect(current().snapshot!.updates).toBe(0);
    client.step();
    flush();
    expect(current().snapshot!.draws).toBeGreaterThanOrEqual(2);
    client.initialize({
      ...defaultSmallXY,
      parameters: { ...defaultSmallXY.parameters, h: 0 },
    });
    flush();
    const beforeRotation = structuredClone(current().snapshot!);
    client.rotate(0.4);
    expect(current().busy).toBe(true);
    expect(() => client.rotate(0.2)).toThrow();
    flush();
    expect(current().snapshot!.version).toBe(beforeRotation.version + 1);
    expect(current().snapshot!.draws).toBe(beforeRotation.draws);
    expect(current().snapshot!.segments).toEqual(beforeRotation.segments);
    client.dispose();
    expect(port.terminate).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
