import { describe, expect, it } from 'vitest';
import {
  median,
  medianAbsoluteDeviation,
  percentDifference,
  percentileRank,
  robustZScore,
} from '@/lib/benchmark/statistics';

describe('median', () => {
  it('returns the middle value for odd-length input', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even-length input', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('is not dragged by a single outlier the way a mean would be', () => {
    const normal = [400, 450, 470, 480, 500];
    const withViral = [...normal, 250_000];
    // The mean more than doubles; the median barely moves.
    expect(median(normal)).toBe(470);
    expect(median(withViral)).toBe(475);
  });

  it('returns null for an empty set', () => {
    expect(median([])).toBeNull();
  });

  it('ignores non-finite values', () => {
    expect(median([1, Number.NaN, 3])).toBe(2);
  });
});

describe('percentDifference', () => {
  it('computes the spec example: 620 against a 470 median', () => {
    const result = percentDifference(620, 470);
    expect(result).not.toBeNull();
    expect(Math.round(result!)).toBe(32);
  });

  it('is negative when below the reference', () => {
    expect(percentDifference(50, 100)).toBe(-50);
  });

  it('is zero when equal', () => {
    expect(percentDifference(100, 100)).toBe(0);
  });

  it('returns null against a zero reference rather than infinity', () => {
    expect(percentDifference(10, 0)).toBeNull();
  });

  it('treats a measured zero value as a real -100%', () => {
    expect(percentDifference(0, 400)).toBe(-100);
  });
});

describe('dispersion', () => {
  it('computes the median absolute deviation', () => {
    expect(medianAbsoluteDeviation([1, 2, 3, 4, 5])).toBe(1);
  });

  it('returns null for a robust z-score when the peer set has no spread', () => {
    expect(robustZScore(10, [5, 5, 5, 5])).toBeNull();
  });

  it('scores a clear outlier above the standout threshold', () => {
    const z = robustZScore(100, [10, 11, 12, 13, 14]);
    expect(z).not.toBeNull();
    expect(Math.abs(z!)).toBeGreaterThan(2);
  });
});

describe('percentileRank', () => {
  it('places a top value near 100', () => {
    expect(percentileRank(100, [1, 2, 3, 4])).toBe(100);
  });

  it('returns null with no peers', () => {
    expect(percentileRank(10, [])).toBeNull();
  });
});
