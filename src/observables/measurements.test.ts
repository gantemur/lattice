import { expect, it } from 'vitest';
import { createHistogram, recordHistogram } from './histogram';
import { emptyMoments, recordMoment, summarizeMoments } from './moments';

it('marks empty and single-sample estimates honestly and uses n − 1 for variance', () => {
  const moments = emptyMoments();
  expect(summarizeMoments(moments)).toEqual({
    count: 0,
    mean: null,
    variance: null,
    secondMoment: null,
  });
  recordMoment(moments, 1);
  expect(summarizeMoments(moments)).toEqual({
    count: 1,
    mean: 1,
    variance: null,
    secondMoment: 1,
  });
  recordMoment(moments, 2);
  recordMoment(moments, 3);
  expect(summarizeMoments(moments)).toEqual({
    count: 3,
    mean: 2,
    variance: 1,
    secondMoment: 14 / 3,
  });
});

it('remains stable for an offset sequence', () => {
  const moments = emptyMoments();
  [1e9 + 1, 1e9 + 2, 1e9 + 3].forEach((x) => recordMoment(moments, x));
  expect(summarizeMoments(moments).variance).toBe(1);
});

it('preserves overflow and uses left-closed right-open histogram bins', () => {
  const histogram = createHistogram(-2, 2, 4);
  [-3, -2, -1.5, -1, 0, 1, 1.999, 2, 3].forEach((x) =>
    recordHistogram(histogram, x),
  );
  expect(histogram).toEqual({
    min: -2,
    max: 2,
    bins: [2, 1, 1, 2],
    below: 1,
    above: 2,
  });
  const retained = 9;
  const areaInView = histogram.bins.reduce(
    (total, bin) => total + bin / retained,
    0,
  );
  expect(areaInView).toBeCloseTo(2 / 3, 14);
  expect(() => recordHistogram(histogram, NaN)).toThrow();
  expect(() => createHistogram(1, 1)).toThrow();
  expect(() => createHistogram(0, 1, 0)).toThrow();
});
