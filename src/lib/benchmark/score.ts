import type { BenchmarkMetricKey } from './metrics';
import type { MetricBenchmark } from './engine';
import { STATUS_BANDS, type PerformanceStatus } from './thresholds';

/**
 * Performance score — a transparent, deterministic 0-100 restatement of the
 * per-metric benchmarks. No randomness, no hidden model.
 *
 * Each contributing metric's percentage difference from the peer median is
 * mapped onto points with a linear ramp that saturates at ±60%:
 *
 *   points = clamp(50 + 50 * (pctDiff / 60), 0, 100)
 *
 * so median performance is 50, +60% or better is 100, -60% or worse is 0. The
 * score is the weighted mean of the available metrics, rescaled over the weight
 * that was actually available. If less than half the weight can be measured, no
 * score is produced at all.
 */

export const SCORE_SATURATION_PERCENT = 60;

/** Minimum share of total weight that must be measurable to produce a score. */
export const MIN_SCORE_COVERAGE = 0.5;

export const SCORE_WEIGHTS: Readonly<Partial<Record<BenchmarkMetricKey, number>>> = {
  views: 0.3,
  averageViewPercentage: 0.25,
  impressionsCtr: 0.25,
  subscribersPer1kViews: 0.2,
};

export interface ScoreContribution {
  readonly metric: BenchmarkMetricKey;
  readonly weight: number;
  readonly percentDifference: number;
  readonly points: number;
}

export interface PerformanceScore {
  readonly score: number | null;
  readonly status: PerformanceStatus;
  readonly coverage: number;
  readonly sampleSize: number;
  readonly contributions: readonly ScoreContribution[];
  readonly missing: readonly BenchmarkMetricKey[];
}

export function pointsFromPercentDifference(
  percentDifference: number,
  higherIsBetter = true,
): number {
  const oriented = higherIsBetter ? percentDifference : -percentDifference;
  const points = 50 + 50 * (oriented / SCORE_SATURATION_PERCENT);
  return clamp(points, 0, 100);
}

/** Score bands derived from the same percentage bands used per metric. */
export function statusFromScore(score: number): PerformanceStatus {
  if (score >= pointsFromPercentDifference(STATUS_BANDS.exceptional)) return 'exceptional';
  if (score >= pointsFromPercentDifference(STATUS_BANDS.strong)) return 'strong';
  if (score > pointsFromPercentDifference(STATUS_BANDS.weak)) return 'typical';
  return 'weak';
}

export function computePerformanceScore(
  benchmarks: Readonly<Record<string, MetricBenchmark>>,
): PerformanceScore {
  const contributions: ScoreContribution[] = [];
  const missing: BenchmarkMetricKey[] = [];
  let totalWeight = 0;
  let availableWeight = 0;
  let weightedPoints = 0;
  let sampleSize = 0;

  for (const [key, weight] of Object.entries(SCORE_WEIGHTS) as [BenchmarkMetricKey, number][]) {
    totalWeight += weight;
    const benchmark = benchmarks[key];
    if (!benchmark || benchmark.percentDifference === null) {
      missing.push(key);
      continue;
    }
    const points = pointsFromPercentDifference(benchmark.percentDifference, benchmark.higherIsBetter);
    contributions.push({ metric: key, weight, percentDifference: benchmark.percentDifference, points });
    availableWeight += weight;
    weightedPoints += points * weight;
    sampleSize = Math.max(sampleSize, benchmark.sampleSize);
  }

  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
  if (coverage < MIN_SCORE_COVERAGE || availableWeight === 0) {
    return {
      score: null,
      status: 'insufficient_data',
      coverage,
      sampleSize,
      contributions,
      missing,
    };
  }

  const score = Math.round(weightedPoints / availableWeight);
  return {
    score,
    status: statusFromScore(score),
    coverage,
    sampleSize,
    contributions,
    missing,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
