import { afterEach, expect, it, vi } from 'vitest';
import { LatticeRun } from '../engine/latticeRun';
import type { SweepCommand, SweepReply } from '../experiments/sweepProtocol';
import { pointConfiguration, sweepPresets } from '../experiments/sweepPlan';
import type { SweepPlan } from '../experiments/sweepPlan';

function plan(measurements = 8): SweepPlan {
  const p = structuredClone(sweepPresets.temperature);
  p.values = [1.5, 2.5, 3.5];
  p.base.parameters.lx = p.base.parameters.ly = 2;
  p.base.warmupSweeps = 0;
  p.base.strideSweeps = 1;
  p.measurementsPerPoint = measurements;
  return p;
}

async function workerHarness() {
  // Fake timers control scheduling; messages still pass through the real
  // worker command handler rather than calling SweepRun methods directly.
  vi.useFakeTimers();
  vi.resetModules();
  const replies: SweepReply[] = [];
  const context = {
    onmessage: null as ((event: MessageEvent<SweepCommand>) => void) | null,
    postMessage(reply: SweepReply) {
      replies.push(reply);
    },
  };
  vi.stubGlobal('self', context);
  await import('./sweep.worker');
  let commandId = 0;
  const sweepId = 'worker-protocol-test';
  function send(
    type: 'pause' | 'resume' | 'cancel' | 'ack',
    pointIndex?: number,
    id = ++commandId,
  ) {
    const data =
      type === 'ack'
        ? { type, sweepId, commandId: id, pointIndex: pointIndex! }
        : { type, sweepId, commandId: id };
    context.onmessage!({ data } as MessageEvent<SweepCommand>);
  }
  function start(p: SweepPlan, id = ++commandId, identity = sweepId) {
    context.onmessage!({
      data: { type: 'start', sweepId: identity, commandId: id, plan: p },
    } as MessageEvent<SweepCommand>);
  }
  function tick() {
    vi.advanceTimersToNextTimer();
  }
  return { replies, send, start, tick, sweepId };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('keeps repeated controls and stale or duplicate point ACKs nonterminal and numerically inert', async () => {
  // Point 1 may start only after ACK(0); a duplicate ACK(0) cannot release
  // point 1. Independent LatticeRun captures below verify unchanged RNG work.
  const p = plan();
  const h = await workerHarness();
  h.start(p);
  h.send('pause');
  h.send('pause');
  h.tick();
  expect(h.replies.at(-1)).toMatchObject({
    type: 'state',
    progress: { status: 'paused', totalUpdates: 0 },
  });
  h.send('resume');
  h.send('resume');
  h.tick();
  expect(h.replies.at(-1)).toMatchObject({
    type: 'point',
    point: { index: 0 },
  });
  const first = h.replies.at(-1)!;
  h.send('ack', 2);
  h.send('ack', 0, 1); // old command ID
  h.tick();
  expect(h.replies.at(-1)).toBe(first);
  h.send('ack', 0);
  h.send('ack', 0); // duplicate cannot acknowledge point 1
  h.tick();
  expect(h.replies.at(-1)).toMatchObject({
    type: 'point',
    point: { index: 1 },
  });
  h.send('ack', 0); // stale while point 1 is staged
  h.tick();
  expect(h.replies.filter((reply) => reply.type === 'point')).toHaveLength(2);
  h.send('ack', 1);
  h.tick();
  expect(h.replies.at(-1)).toMatchObject({
    type: 'point',
    point: { index: 2 },
    progress: { status: 'completed' },
  });
  h.send('ack', 1);
  expect(h.replies.filter((reply) => reply.type === 'terminal')).toHaveLength(
    0,
  );
  h.send('pause'); // completed point still awaits its own ACK
  expect(h.replies.at(-1)).toMatchObject({ type: 'command-error' });
  expect(h.replies.filter((reply) => reply.type === 'terminal')).toHaveLength(
    0,
  );
  h.send('ack', 2);
  h.send('cancel');
  expect(h.replies.filter((reply) => reply.type === 'terminal')).toHaveLength(
    1,
  );
  const replyCount = h.replies.length;
  h.start(p, 1); // old Start cannot restart the finished sweep
  h.start(p, 1, 'another-stale-sweep');
  expect(h.replies).toHaveLength(replyCount);
  const points = h.replies.flatMap((reply) =>
    reply.type === 'point' ? [reply.point] : [],
  );
  expect(points).toHaveLength(3);
  for (const point of points) {
    const control = new LatticeRun(
      point.index + 1,
      pointConfiguration(p, point.index),
    );
    control.advance(point.updates);
    expect(point.capture).toEqual(control.capture(1, true));
  }
});

it('cancels incomplete running and paused points once with exact partial counts', async () => {
  for (const pause of [false, true]) {
    const h = await workerHarness();
    h.start(plan(2048));
    h.tick(); // first 4096-update batch, still inside point 0
    if (pause) {
      h.send('pause');
      h.send('pause');
    }
    h.send('cancel');
    h.send('cancel');
    h.tick();
    const terminal = h.replies.filter((reply) => reply.type === 'terminal');
    expect(terminal).toHaveLength(1);
    expect(terminal[0]).toMatchObject({
      progress: { status: 'cancelled', totalUpdates: 4096 },
      partial: { index: 0, updates: 4096, measurements: 1024 },
    });
    expect(h.replies.filter((reply) => reply.type === 'point')).toHaveLength(0);
  }
});

it('cancels while awaiting archival without sampling another point or losing the completed capture', async () => {
  const p = plan();
  const h = await workerHarness();
  h.start(p);
  h.tick();
  const point = h.replies.find((reply) => reply.type === 'point');
  expect(point?.type).toBe('point');
  h.send('cancel');
  h.send('ack', 0);
  h.tick();
  expect(h.replies.filter((reply) => reply.type === 'terminal')).toHaveLength(
    1,
  );
  expect(h.replies.at(-1)).toMatchObject({
    type: 'terminal',
    progress: { status: 'cancelled', completedPoints: 1, totalUpdates: 32 },
    partial: { index: 1, updates: 0, measurements: 0 },
  });
  expect(h.replies.filter((reply) => reply.type === 'point')).toHaveLength(1);
  if (point?.type === 'point') {
    const control = new LatticeRun(1, pointConfiguration(p, 0));
    control.advance(point.point.updates);
    expect(point.point.capture).toEqual(control.capture(1, true));
  }
});

it('treats final-point ACK as the only completion boundary and cancel before it as completed', async () => {
  const h = await workerHarness();
  h.start(plan());
  for (let index = 0; index < 2; index++) {
    h.tick();
    h.send('ack', index);
  }
  h.tick();
  expect(h.replies.at(-1)).toMatchObject({
    type: 'point',
    point: { index: 2 },
    progress: { status: 'completed' },
  });
  expect(h.replies.filter((reply) => reply.type === 'terminal')).toHaveLength(
    0,
  );
  h.send('cancel');
  h.send('ack', 2);
  expect(h.replies.filter((reply) => reply.type === 'terminal')).toHaveLength(
    1,
  );
  expect(h.replies.at(-1)).toMatchObject({
    type: 'terminal',
    progress: { status: 'completed', completedPoints: 3 },
    partial: null,
  });
});
