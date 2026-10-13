import { describe, expect, it } from 'vitest';
import type { FieldWorkerPort, FieldView } from './fieldClient';
import { FieldClient } from './fieldClient';
import { FieldEngine, FieldRun, defaultQuarticConfiguration } from './fieldRun';
import type { FieldRequest, FieldResponse } from './fieldRun';
import { defaultPhi4Configuration } from './fieldRun';
import { quarticQuadraticPart } from '../models/quarticOscillator';

const p = { sites: 4, beta: 4, r: 1, lambda: 1, h: 0 };
const hmc = {
  model: 'quartic-oscillator' as const,
  quartic: p,
  parameters: quarticQuadraticPart(p),
  sampler: { kind: 'hmc' as const, stepSize: 0.1, leapfrogSteps: 12 },
  warmupTrajectories: 0,
  strideTrajectories: 1,
};

class WorkerDouble implements FieldWorkerPort {
  onmessage: ((event: MessageEvent<FieldResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  requests: FieldRequest[] = [];
  private engine = new FieldEngine();
  postMessage(request: FieldRequest) {
    this.requests.push(request);
    queueMicrotask(() =>
      this.onmessage?.({
        data: this.engine.handle(request),
      } as MessageEvent<FieldResponse>),
    );
  }
  terminate() {}
}

describe('sampler-aware field client scheduling', () => {
  it('runs 16-trajectory HMC batches, pauses at acknowledgments and replays Step', async () => {
    const port = new WorkerDouble();
    const state: { view: FieldView | null } = { view: null };
    const client = new FieldClient(
      () => port,
      (next) => {
        state.view = next;
      },
    );
    client.initialize({ ...hmc, seed: 12345 });
    await Promise.resolve();
    client.start();
    expect(port.requests.at(-1)).toMatchObject({ type: 'advance', count: 16 });
    client.pause();
    await Promise.resolve();
    client.start();
    expect(port.requests.at(-1)).toMatchObject({ type: 'advance', count: 16 });
    client.pause();
    await Promise.resolve();
    client.step();
    expect(port.requests.at(-1)).toMatchObject({ type: 'advance', count: 1 });
    await Promise.resolve();
    const direct = new FieldRun(1, { ...hmc, seed: 12345 });
    direct.advance(32);
    direct.advance(1);
    expect(state.view?.snapshot).toEqual(direct.snapshot());
    client.dispose();
  });

  it('orders a parameter change after one posted HMC batch', async () => {
    const port = new WorkerDouble();
    const state: { view: FieldView | null } = { view: null };
    const client = new FieldClient(
      () => port,
      (next) => {
        state.view = next;
      },
    );
    client.initialize({ ...hmc, seed: 12345 });
    await Promise.resolve();
    client.start();
    const tilted = { ...p, h: 0.3 };
    const changed = {
      ...hmc,
      quartic: tilted,
      parameters: quarticQuadraticPart(tilted),
    };
    client.change(changed);
    client.pause();
    await Promise.resolve();
    expect(port.requests.at(-1)?.type).toBe('change');
    await Promise.resolve();
    client.step();
    await Promise.resolve();
    const direct = new FieldRun(1, { ...hmc, seed: 12345 });
    direct.advance(16);
    direct.changeSettings(changed);
    direct.advance(1);
    expect(state.view?.snapshot).toEqual(direct.snapshot());
    client.dispose();
  });

  it('retains 128-update scheduling for the original local quartic sampler', async () => {
    const port = new WorkerDouble();
    const client = new FieldClient(
      () => port,
      () => {},
    );
    client.initialize(defaultQuarticConfiguration);
    await Promise.resolve();
    client.start();
    expect(port.requests.at(-1)).toMatchObject({ type: 'advance', count: 128 });
    client.pause();
    await Promise.resolve();
    client.dispose();
  });
});

describe('spatial HMC scheduling and pending commands', () => {
  const settings = {
    model: 'phi4-field' as const,
    parameters: defaultPhi4Configuration.parameters,
    sampler: { kind: 'hmc' as const, stepSize: 0.06, leapfrogSteps: 12 },
    warmupTrajectories: 0,
    strideTrajectories: 1,
  };
  it('runs eight trajectories, queues parameter changes after acknowledgments and preserves pause/Step replay', async () => {
    const port = new WorkerDouble();
    const state: { view: FieldView | null } = { view: null };
    const client = new FieldClient(
      () => port,
      (next) => {
        state.view = next;
      },
    );
    client.initialize({ ...settings, seed: 12345 });
    await Promise.resolve();
    client.start();
    expect(port.requests.at(-1)).toMatchObject({ type: 'advance', count: 8 });
    const changed = {
      ...settings,
      parameters: { ...settings.parameters, source: 0.2 },
    };
    client.change(changed);
    client.pause();
    client.step();
    expect(port.requests.at(-1)).toMatchObject({ type: 'advance', count: 8 });
    await Promise.resolve();
    expect(port.requests.at(-1)?.type).toBe('change');
    await Promise.resolve();
    client.start();
    client.pause();
    await Promise.resolve();
    client.step();
    await Promise.resolve();
    const direct = new FieldRun(1, { ...settings, seed: 12345 });
    direct.advance(8);
    direct.changeSettings(changed);
    direct.advance(8);
    direct.advance(1);
    expect(state.view?.snapshot).toEqual(direct.snapshot());
    client.dispose();
  });
  it('keeps spatial local Metropolis at 128 attempts', async () => {
    const port = new WorkerDouble(),
      client = new FieldClient(
        () => port,
        () => {},
      );
    client.initialize(defaultPhi4Configuration);
    await Promise.resolve();
    client.start();
    client.pause();
    expect(port.requests.at(-1)).toMatchObject({ type: 'advance', count: 128 });
    await Promise.resolve();
    client.dispose();
  });
});
