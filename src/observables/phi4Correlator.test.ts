import { expect, it } from 'vitest';
import { phi4Correlations } from './phi4Correlator';
it('averages only admissible pairs and centers by individual ensemble site means', () => {
  const means = [1, 2, 3, 4, 5, 6];
  const pair = means.map((a, i) =>
    means.map((b, j) => a * b + (i === j ? 2 : 0)),
  );
  for (const periodicX of [false, true])
    for (const periodicY of [false, true]) {
      const shape = {
        kind: 'rectangle' as const,
        lx: 2,
        ly: 3,
        periodicX,
        periodicY,
      };
      const x = phi4Correlations(shape, pair, means, 1, 'x'),
        y = phi4Correlations(shape, pair, means, 1, 'y');
      expect(x[1]!.pairs).toBe(periodicX ? 6 : 3);
      expect(y[1]!.pairs).toBe(periodicY ? 6 : 4);
      expect(x[1]!.connected).toBe(0);
      expect(y[1]!.connected).toBe(0);
      expect(x[0]!.connected).toBe(2);
      expect(x[1]!.raw).toBe((2 + 12 + 30) / 3);
      // At zero source use reflection symmetry, not the biased finite-chain mean.
      expect(phi4Correlations(shape, pair, means, 0, 'x')[1]!.connected).toBe(
        x[1]!.raw,
      );
    }
});
it('has no transverse chain quantity and preserves a constant-field raw correlator', () => {
  const shape = { kind: 'chain' as const, length: 4, periodic: true },
    pair = Array.from({ length: 4 }, () => [9, 9, 9, 9]);
  expect(phi4Correlations(shape, pair, [3, 3, 3, 3], 0, 'y')).toEqual([]);
  expect(
    phi4Correlations(shape, pair, [3, 3, 3, 3], 0, 'x').map((p) => p.raw),
  ).toEqual([9, 9, 9]);
});
