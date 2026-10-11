import { describe, expect, it } from 'vitest';
import { createRng } from '../algorithms/rng';
import {
  analyzeSeries,
  DiagnosticHistory,
  DIAGNOSTIC_CAPACITY,
} from './statisticalDiagnostics';

describe('bounded autocorrelation diagnostics', () => {
  it('distinguishes insufficient and constant observations', () => {
    expect(analyzeSeries([1, 2], 'm', 5).status).toBe('insufficient');
    const constant = analyzeSeries(Array(1024).fill(1), 'm', 5);
    expect(constant.status).toBe('constant');
    expect(constant.tauMeasurements).toBeNull();
    expect(constant.standardError).toBeNull();
  });

  it('recovers independent-sample scaling and measurement-to-sweep units', () => {
    const rng = createRng(123);
    const series = Array.from({ length: 8192 }, () =>
      rng.uniform() < 0.5 ? -1 : 1,
    );
    const result = analyzeSeries(series, 'm', 5);
    expect(result.status).not.toBe('unresolved');
    expect(result.tauMeasurements!).toBeGreaterThanOrEqual(0.5);
    expect(result.tauMeasurements!).toBeLessThan(0.9);
    expect(result.tauSweeps).toBeCloseTo(result.tauMeasurements! * 5, 12);
    expect(result.ess!).toBeLessThanOrEqual(series.length);
    expect(result.standardError!).toBeCloseTo(
      Math.sqrt(
        (2 * result.tauMeasurements! * result.variance!) / (series.length - 1),
      ),
      12,
    );
    expect(result.blocking.at(-1)!.blocks).toBeGreaterThanOrEqual(16);
  });

  it('matches the factor-of-two tau convention for stationary two-state chains', () => {
    const taus: number[] = [];
    for (let seed = 1; seed <= 8; seed++) {
      const rng = createRng(seed);
      let spin = rng.uniform() < 0.5 ? -1 : 1;
      const series = Array.from({ length: 8192 }, () => {
        if (rng.uniform() < 0.2) spin = -spin;
        return spin;
      });
      const result = analyzeSeries(series, 'm', 1);
      expect(result.tauMeasurements).not.toBeNull();
      taus.push(result.tauMeasurements!);
    }
    // λ=1−2a=0.6; tau=(1+λ)/(2(1−λ))=2 retained measurements.
    expect(taus.reduce((a, b) => a + b, 0) / taus.length).toBeCloseTo(2, 0);
  });

  it('tracks an AR(1) ensemble and shows blocking inflation under correlation', () => {
    const estimates: number[] = [];
    for (let seed = 10; seed < 18; seed++) {
      const rng = createRng(seed);
      let x = 0;
      const values = Array.from({ length: 8192 }, () => {
        const u = rng.uniform(),
          v = rng.uniform();
        const innovation =
          Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        x = 0.6 * x + innovation;
        return x;
      });
      const result = analyzeSeries(values, 'e', 1);
      expect(result.tauMeasurements).not.toBeNull();
      estimates.push(result.tauMeasurements!);
      expect(
        result.blocking.find((point) => point.blockSize === 16)!.standardError,
      ).toBeGreaterThan(result.blocking[0]!.standardError);
    }
    // AR(1) rho(k)=0.6^k, tau=(1+0.6)/(2(1−0.6))=2.
    expect(estimates.reduce((a, b) => a + b, 0) / estimates.length).toBeCloseTo(
      2,
      0,
    );
  });

  it('detects unresolved very slow chains and visibly drifting records', () => {
    const rng = createRng(66);
    let spin = 1;
    const slow = Array.from({ length: 8192 }, () => {
      if (rng.uniform() < 0.001) spin = -spin;
      return spin;
    });
    const unresolved = analyzeSeries(slow, 'm', 1);
    expect(['unresolved', 'drift']).toContain(unresolved.status);
    expect(unresolved.ess).toBeNull();
    const drifting = Array.from(
      { length: 8192 },
      (_, i) => (i < 4096 ? -2 : 2) + (rng.uniform() - 0.5),
    );
    const drift = analyzeSeries(drifting, 'e', 1);
    expect(['unresolved', 'drift']).toContain(drift.status);
    expect(drift.standardError).toBeNull();
  });

  it('keeps an aligned bounded recent window and refreshes by measurement count', () => {
    const history = new DiagnosticHistory(3);
    for (let i = 1; i <= DIAGNOSTIC_CAPACITY + 256; i++)
      history.record(i, Math.abs(i), -i);
    const snapshot = history.snapshot();
    expect(snapshot.m.used).toBe(DIAGNOSTIC_CAPACITY);
    expect(snapshot.m.total).toBe(DIAGNOSTIC_CAPACITY + 256);
    expect(snapshot.m.evicted).toBe(256);
    expect(snapshot.m.firstMeasurement).toBe(257);
    expect(snapshot.m.lastMeasurement).toBe(DIAGNOSTIC_CAPACITY + 256);
    expect(snapshot.e.firstMeasurement).toBe(snapshot.m.firstMeasurement);
    expect(snapshot.m.strideSweeps).toBe(3);
    expect(snapshot.m.mean).toBeCloseTo(
      (257 + DIAGNOSTIC_CAPACITY + 256) / 2,
      10,
    );
    expect(snapshot.m.acf.length).toBeLessThanOrEqual(129);
  });
});
