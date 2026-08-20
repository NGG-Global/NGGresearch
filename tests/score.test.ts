import { describe, expect, it } from 'vitest';
import type { MetricBenchmark } from '@/lib/benchmark';
import {
  computePerformanceScore,
  pointsFromPercentDifference,
  statusFromScore,
} from '@/lib/benchmark/score';

function benchmark(overrides: Partial<MetricBenchmark> & { metric: MetricBenchmark['metric'] }): MetricBenchmark {
  return {
    value: 100,
    metricState: 'available',
    benchmark: 100,
    percentDifference: 0,
    sampleSize: 8,
    status: 'typical',
    quality: 'milestone',
    percentileRank: 50,
    robustZScore: 0,
    standsOutFromSpread: false,
    higherIsBetter: true,
    ...overrides,
  };
}

describe('pointsFromPercentDifference', () => {
  it('maps median performance to 50', () => {
    expect(pointsFromPercentDifference(0)).toBe(50);
  });

  it('saturates at the configured ceiling and floor', () => {
    expect(pointsFromPercentDifference(60)).toBe(100);
    expect(pointsFromPercentDifference(200)).toBe(100);
    expect(pointsFromPercentDifference(-60)).toBe(0);
    expect(pointsFromPercentDifference(-500)).toBe(0);
  });

  it('is monotonic and deterministic', () => {
    expect(pointsFromPercentDifference(10)).toBeLessThan(pointsFromPercentDifference(20));
    expect(pointsFromPercentDifference(32)).toBe(pointsFromPercentDifference(32));
  });

  it('inverts for metrics where lower is better', () => {
    expect(pointsFromPercentDifference(-30, false)).toBeGreaterThan(50);
  });
});

describe('statusFromScore', () => {
  it('uses bands consistent with the per-metric thresholds', () => {
    // The same +35% / +12% / -12% boundaries, expressed in points.
    expect(statusFromScore(pointsFromPercentDifference(35))).toBe('exceptional');
    expect(statusFromScore(pointsFromPercentDifference(12))).toBe('strong');
    expect(statusFromScore(pointsFromPercentDifference(0))).toBe('typical');
    expect(statusFromScore(pointsFromPercentDifference(-12))).toBe('weak');
  });
});

describe('computePerformanceScore', () => {
  it('scores a median performer at 50', () => {
    const result = computePerformanceScore({
      views: benchmark({ metric: 'views', percentDifference: 0 }),
      averageViewPercentage: benchmark({ metric: 'averageViewPercentage', percentDifference: 0 }),
      impressionsCtr: benchmark({ metric: 'impressionsCtr', percentDifference: 0 }),
      subscribersPer1kViews: benchmark({ metric: 'subscribersPer1kViews', percentDifference: 0 }),
    });

    expect(result.score).toBe(50);
    expect(result.status).toBe('typical');
    expect(result.coverage).toBe(1);
  });

  it('weights the contributing metrics as configured', () => {
    const result = computePerformanceScore({
      views: benchmark({ metric: 'views', percentDifference: 60 }),
      averageViewPercentage: benchmark({ metric: 'averageViewPercentage', percentDifference: 0 }),
      impressionsCtr: benchmark({ metric: 'impressionsCtr', percentDifference: 0 }),
      subscribersPer1kViews: benchmark({ metric: 'subscribersPer1kViews', percentDifference: 0 }),
    });
    // views carries 0.30 of the weight: 100*0.3 + 50*0.7 = 65
    expect(result.score).toBe(65);
  });

  it('rescales over the metrics that are actually available', () => {
    const result = computePerformanceScore({
      views: benchmark({ metric: 'views', percentDifference: 60 }),
      averageViewPercentage: benchmark({ metric: 'averageViewPercentage', percentDifference: 60 }),
      // CTR pending (reach report not in yet), subs missing.
      impressionsCtr: benchmark({ metric: 'impressionsCtr', percentDifference: null, metricState: 'pending' }),
    });

    expect(result.score).toBe(100);
    expect(result.missing).toContain('impressionsCtr');
    expect(result.missing).toContain('subscribersPer1kViews');
    expect(result.coverage).toBeCloseTo(0.55, 5);
  });

  it('refuses to score when too little of the weight can be measured', () => {
    const result = computePerformanceScore({
      views: benchmark({ metric: 'views', percentDifference: 40 }),
    });

    expect(result.coverage).toBeLessThan(0.5);
    expect(result.score).toBeNull();
    expect(result.status).toBe('insufficient_data');
  });

  it('refuses to score with no comparable metrics at all', () => {
    const result = computePerformanceScore({});
    expect(result.score).toBeNull();
    expect(result.status).toBe('insufficient_data');
    expect(result.contributions).toHaveLength(0);
  });

  it('never produces a random or out-of-range score', () => {
    const extreme = computePerformanceScore({
      views: benchmark({ metric: 'views', percentDifference: 100_000 }),
      averageViewPercentage: benchmark({ metric: 'averageViewPercentage', percentDifference: 100_000 }),
      impressionsCtr: benchmark({ metric: 'impressionsCtr', percentDifference: 100_000 }),
      subscribersPer1kViews: benchmark({ metric: 'subscribersPer1kViews', percentDifference: 100_000 }),
    });
    expect(extreme.score).toBe(100);

    const floor = computePerformanceScore({
      views: benchmark({ metric: 'views', percentDifference: -100 }),
      averageViewPercentage: benchmark({ metric: 'averageViewPercentage', percentDifference: -100 }),
      impressionsCtr: benchmark({ metric: 'impressionsCtr', percentDifference: -100 }),
      subscribersPer1kViews: benchmark({ metric: 'subscribersPer1kViews', percentDifference: -100 }),
    });
    expect(floor.score).toBe(0);
  });
});
