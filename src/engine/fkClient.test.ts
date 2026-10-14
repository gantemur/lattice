import { expect, it, vi } from 'vitest';
import { PottsClient } from './pottsClient';
import type { PottsPort, PottsView } from './pottsClient';
import { PottsEngine, PottsRun, defaultSmallPotts } from './pottsRun';
import type {
  PottsRequest,
  PottsResponse,
  PottsConfiguration,
} from './pottsRun';
for (const sampler of ['fk-direct', 'sw'] as const)
  it(`${sampler} actual client/handler: bounded run, queued Apply, repeated Pause and stale Reset`, () => {
    vi.useFakeTimers();
    try {
      const configuration: PottsConfiguration = {
        ...defaultSmallPotts,
        ...(sampler === 'sw'
          ? { sampler, warmupTrajectories: 0, strideTrajectories: 1 }
          : { sampler }),
      };
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
      const deliver = (r: PottsResponse) =>
        port.onmessage!({ data: r } as MessageEvent<PottsResponse>);
      const flush = () => {
        const reply = engine.handle(requests.shift()!);
        deliver(reply);
        return reply;
      };
      client.initialize(configuration);
      flush();
      client.start();
      client.start();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ type: 'advance', count: 8 });
      const next = {
        ...configuration,
        parameters: {
          ...configuration.parameters,
          geometry: { ...configuration.parameters.geometry },
        },
      };
      if (next.parameters.geometry.kind === 'graph')
        next.parameters.geometry = {
          ...next.parameters.geometry,
          couplings: { e0: 1.2 },
        };
      client.change(next);
      client.pause();
      client.pause();
      expect(current().busy).toBe(true);
      const old = flush();
      expect(requests).toHaveLength(1);
      expect(requests[0]!.type).toBe('change');
      flush();
      vi.advanceTimersByTime(1000);
      expect(requests).toHaveLength(0);
      expect(current().snapshot!.updates).toBe(8);
      expect(current().snapshot!.segments[0]!.samples).toBe(8);
      expect(current().snapshot!.cluster).toBeUndefined();
      client.step();
      flush();
      const oracle = new PottsRun(configuration);
      oracle.advance(8);
      oracle.change(next);
      oracle.advance(1);
      expect(current().snapshot).toEqual(oracle.snapshot());
      client.initialize(configuration);
      flush();
      deliver(old);
      expect(current().snapshot!.updates).toBe(0);
      expect(current().snapshot!.draws).toBe(0);
      client.dispose();
      expect(port.terminate).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
