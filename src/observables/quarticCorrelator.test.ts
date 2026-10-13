import { describe, expect, it } from 'vitest';
import {
  quarticCorrelationProjection,
  quarticEffectiveEnergy,
} from './quarticCorrelator';
import { pathCorrelator } from './oscillatorCorrelator';

describe('interacting path correlation conventions', () => {
  it('keeps raw C at h=0 even if the observed sample mean is nonzero', () => {
    const path = [1, 2, 1, 2];
    const pair = path.map((x) => path.map((y) => x * y));
    const projected = quarticCorrelationProjection(pair, 1.5, 0);
    expect(projected.raw).toEqual(pathCorrelator(path));
    expect(projected.connected).toEqual(projected.raw);
    expect(projected.meanForCentering).toBe(0);
  });
  it('uses the full-segment translational mean only for h≠0', () => {
    const path = [1, 2, 1, 2];
    const pair = path.map((x) => path.map((y) => x * y));
    const projected = quarticCorrelationProjection(pair, 1.5, 0.4);
    expect(projected.connected?.[0]).toBeCloseTo(0.25, 12);
    expect(projected.centering).toBe('sample-plug-in');
    expect(quarticCorrelationProjection(pair, null, 0.4).connected).toBeNull();
  });
  it('distinguishes sample threshold, valid ratio and cancellation', () => {
    const path = [1, 2, 1, 2];
    const pair = path.map((x) => path.map((y) => x * y));
    const projected = quarticCorrelationProjection(pair, 1.5, 0);
    expect(quarticEffectiveEnergy(projected, 63, 1, 1, 4).status).toBe(
      'insufficient-samples',
    );
    expect(quarticEffectiveEnergy(projected, 64, 1, 1, 4).status).toBe(
      'provisional',
    );
    const cancelled = quarticCorrelationProjection(
      pair,
      Math.sqrt(projected.raw[1]!),
      0.4,
    );
    expect(quarticEffectiveEnergy(cancelled, 64, 1, 1, 4).status).toBe(
      'cancellation-sensitive',
    );
  });
});
