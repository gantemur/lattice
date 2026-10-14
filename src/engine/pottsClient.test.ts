import { expect, it, vi } from 'vitest';
import { PottsClient } from './pottsClient';
import type { PottsPort, PottsView } from './pottsClient';
import { PottsEngine, defaultSmallPotts } from './pottsRun';
import type { PottsRequest, PottsResponse } from './pottsRun';
it('actual handler behind client: queued Apply, repeated controls, pause acknowledgment and reset/stale replies', () => {
  vi.useFakeTimers();
  try {
    const requests: PottsRequest[] = [],
      engine = new PottsEngine();
    let view: PottsView | null = null;
    const port: PottsPort = {
      postMessage: (r) => requests.push(r),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
    const client = new PottsClient(
      () => port,
      (v) => {
        view = v;
      },
    );
    const current = () => view!;
    const deliver = (reply: PottsResponse) =>
      port.onmessage!({ data: reply } as MessageEvent<PottsResponse>);
    const flush = () => {
      const request = requests.shift()!;
      const reply = engine.handle(request);
      deliver(reply);
      return reply;
    };
    client.initialize(defaultSmallPotts);
    expect(current().busy).toBe(true);
    flush();
    client.start();
    client.start();
    expect(requests).toHaveLength(1);
    expect(() => client.step()).toThrow();
    client.change({
      ...defaultSmallPotts,
      parameters: { ...defaultSmallPotts.parameters, h: -0.4 },
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
    client.step();
    flush();
    expect(current().snapshot!.updates).toBe(129);
    client.start();
    client.initialize(defaultSmallPotts);
    const delayed = engine.handle(requests.shift()!);
    flush();
    expect(current().snapshot!.updates).toBe(0);
    deliver(delayed);
    deliver(old);
    expect(current().snapshot!.updates).toBe(0);
    client.step();
    flush();
    expect(current().snapshot!.draws).toBe(1);
    client.dispose();
    expect(port.terminate).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
