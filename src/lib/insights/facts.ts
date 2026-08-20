import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { metricDefinition, type BenchmarkMetricKey, type PerformanceStatus } from '@/lib/benchmark';
import type { ComparisonQuality } from '@/lib/benchmark/engine';
import { contentTypeLabel } from '@/lib/domain/classification';
import { milestoneLabel } from '@/lib/domain/snapshots';
import type { MetricState } from '@/lib/domain/metric';
import type { ContentType, SnapshotSource, SnapshotTarget } from '@/lib/domain/types';
import { formatVideoAge } from '@/lib/format';

/**
 * The structured, provider-agnostic fact sheet. Insight providers see only
 * this — never raw API payloads — which keeps generated copy grounded in the
 * same numbers the UI displays.
 */
export interface InsightMetricFact {
  readonly key: BenchmarkMetricKey;
  readonly label: string;
  readonly labelHe: string;
  readonly unit: string;
  readonly state: MetricState;
  readonly value: number | null;
  readonly benchmarkMedian: number | null;
  readonly percentDifference: number | null;
  readonly sampleSize: number;
  readonly status: PerformanceStatus;
  readonly standsOutFromSpread: boolean;
}

export interface InsightFacts {
  readonly channelTitle: string;
  readonly video: {
    readonly title: string;
    readonly publishedAt: string;
    readonly ageHours: number;
    readonly ageLabelHe: string;
    readonly durationSeconds: number | null;
    readonly contentType: ContentType;
    readonly contentTypeLabelHe: string;
    readonly benchmarkEligible: boolean;
  };
  readonly snapshot: {
    readonly target: SnapshotTarget;
    readonly targetLabelHe: string;
    readonly source: SnapshotSource;
    readonly capturedAt: string;
    readonly videoAgeHoursAtCapture: number;
  } | null;
  readonly comparison: {
    readonly sampleSize: number;
    readonly quality: ComparisonQuality;
    readonly hasEnoughData: boolean;
  };
  readonly score: {
    readonly value: number | null;
    readonly status: PerformanceStatus;
    readonly coverage: number;
  };
  readonly metrics: readonly InsightMetricFact[];
  readonly missingMetrics: readonly string[];
  readonly dataQualityNotes: readonly string[];
}

const REPORTED_METRICS: readonly BenchmarkMetricKey[] = [
  'views',
  'impressionsCtr',
  'averageViewPercentage',
  'averageViewDurationSeconds',
  'watchTimeMinutes',
  'subscribersPer1kViews',
  'subscribersGained',
  'likes',
  'comments',
];

export function buildInsightFacts(
  analysis: VideoAnalysis,
  channelTitle: string,
): InsightFacts {
  const metrics: InsightMetricFact[] = [];
  const missing: string[] = [];

  for (const key of REPORTED_METRICS) {
    const benchmark = analysis.benchmarks[key];
    if (!benchmark) continue;
    const definition = metricDefinition(key);

    if (benchmark.metricState !== 'available') {
      missing.push(`${definition.labelHe} (${benchmark.metricState === 'pending' ? 'ממתין' : 'לא זמין'})`);
      continue;
    }

    metrics.push({
      key,
      label: definition.label,
      labelHe: definition.labelHe,
      unit: definition.unit,
      state: benchmark.metricState,
      value: benchmark.value,
      benchmarkMedian: benchmark.benchmark,
      percentDifference: benchmark.percentDifference,
      sampleSize: benchmark.sampleSize,
      status: benchmark.status,
      standsOutFromSpread: benchmark.standsOutFromSpread,
    });
  }

  return {
    channelTitle,
    video: {
      title: analysis.video.title,
      publishedAt: analysis.video.publishedAt,
      ageHours: Math.round(analysis.ageHours),
      ageLabelHe: formatVideoAge(analysis.ageHours),
      durationSeconds: analysis.video.durationSeconds,
      contentType: analysis.video.classification.contentType,
      contentTypeLabelHe: contentTypeLabel(analysis.video.classification.contentType),
      benchmarkEligible: analysis.video.classification.benchmarkEligible,
    },
    snapshot: analysis.snapshot
      ? {
          target: analysis.snapshot.snapshotTarget,
          targetLabelHe: milestoneLabel(analysis.snapshot.snapshotTarget),
          source: analysis.snapshot.snapshotSource,
          capturedAt: analysis.snapshot.capturedAt,
          videoAgeHoursAtCapture: Math.round(analysis.snapshot.videoAgeHours),
        }
      : null,
    comparison: {
      sampleSize: analysis.comparison.sampleSize,
      quality: analysis.comparison.quality,
      hasEnoughData: analysis.comparison.hasEnoughData,
    },
    score: {
      value: analysis.score.score,
      status: analysis.score.status,
      coverage: Number(analysis.score.coverage.toFixed(2)),
    },
    metrics,
    missingMetrics: missing,
    dataQualityNotes: analysis.dataQualityNotes,
  };
}

/** Metrics ordered by how far they deviate from the benchmark, largest first. */
export function metricsByDeviation(facts: InsightFacts): readonly InsightMetricFact[] {
  return [...facts.metrics]
    .filter((m) => m.percentDifference !== null)
    .sort((a, b) => Math.abs(b.percentDifference!) - Math.abs(a.percentDifference!));
}
