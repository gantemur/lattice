import { expect, it } from 'vitest';
import { SweepClient } from './sweepClient';
import type { SweepReply } from './sweepProtocol';
import { sweepPresets } from './sweepPlan';

it('rejects duplicate Start, stale sweep identities and out-of-order progress frames', () => {
  const messages: unknown[] = [];
  const worker = {
    onmessage: null as ((event: MessageEvent<SweepReply>) => void) | null,
    postMessage(message: unknown) {
      messages.push(message);
    },
    terminate() {},
  };
  const client = new SweepClient(worker as unknown as Worker);
  const received: SweepReply[] = [];
  client.onReply = (reply) => received.push(reply);
  const id = client.start(sweepPresets.temperature);
  expect(() => client.start(sweepPresets.temperature)).toThrow(
    /already active/,
  );
  const progress = {
    status: 'running' as const,
    pointIndex: 0,
    completedPoints: 0,
    currentPointUpdates: 0,
    currentPointMeasurements: 0,
    totalUpdates: 0,
    requestedUpdates: 10,
  };
  const reply = (
    sweepId: string,
    sequence: number,
    commandId = 1,
  ): SweepReply => ({ type: 'state', sweepId, commandId, sequence, progress });
  worker.onmessage!({ data: reply('other', 1) } as MessageEvent<SweepReply>);
  worker.onmessage!({ data: reply(id, 1) } as MessageEvent<SweepReply>);
  worker.onmessage!({ data: reply(id, 1) } as MessageEvent<SweepReply>);
  worker.onmessage!({ data: reply(id, 0) } as MessageEvent<SweepReply>);
  worker.onmessage!({ data: reply(id, 2, 99) } as MessageEvent<SweepReply>);
  expect(received).toHaveLength(1);
  client.command('pause');
  expect(messages).toHaveLength(2);
  worker.onmessage!({
    data: {
      type: 'terminal',
      sweepId: id,
      commandId: 2,
      sequence: 2,
      progress: { ...progress, status: 'cancelled' },
      partial: null,
      error: null,
    },
  } as MessageEvent<SweepReply>);
  expect(() => client.command('cancel')).toThrow(/No active/);
  const next = client.start(sweepPresets.temperature);
  worker.onmessage!({ data: reply(id, 3, 2) } as MessageEvent<SweepReply>);
  expect(received).toHaveLength(2);
  expect(next).not.toBe(id);
});
