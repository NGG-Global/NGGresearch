import {
  benchmarkMetrics,
  buildComparisonSet,
  computePerformanceScore,
  INSUFFICIENT_BENCHMARK_MESSAGE_HE,
  METRIC_DEFINITIONS,
  type BenchmarkCandidate,
  type BenchmarkMetricKey,
  type ComparisonSet,
  type MetricBenchmark,
  type PerformanceScore,
} from '@/lib/benchmark';
import { classificationSourceLabel, contentTypeLabel } from '@/lib/domain/classification';
import {
  availableTargets,
  defaultTarget,
  selectSnapshot,
  videoAgeHours,
} from '@/lib/domain/snapshots';
import type { AnalyticsSnapshot, SnapshotTarget, Video } from '@/lib/domain/types';

const ALL_METRIC_KEYS: readonly BenchmarkMetricKey[] = METRIC_DEFINITIONS.map((d) => d.key);

export interface VideoAnalysis {
  readonly video: Video;
  readonly ageHours: number;
  readonly target: SnapshotTarget | null;
  readonly availableTargets: readonly SnapshotTarget[];
  readonly snapshot: AnalyticsSnapshot | null;
  readonly snapshots: readonly AnalyticsSnapshot[];
  readonly comparison: ComparisonSet;
  readonly benchmarks: Readonly<Record<string, MetricBenchmark>>;
  readonly score: PerformanceScore;
  /**
   * Plain-Hebrew caveats about the data behind this analysis. Rendered in the
   * UI so precision is never implied where the source cannot support it.
   */
  readonly dataQualityNotes: readonly string[];
}

export function analyseVideo(params: {
  video: Video;
  snapshots: readonly AnalyticsSnapshot[];
  candidates: readonly BenchmarkCandidate[];
  target?: SnapshotTarget | null;
  now?: Date;
}): VideoAnalysis {
  const { video, snapshots, candidates } = params;
  const now = params.now ?? new Date();
  const ageHours = videoAgeHours(video.publishedAt, now);
  const targets = availableTargets(snapshots);
  const target = params.target && targets.includes(params.target)
    ? params.target
    : defaultTarget(snapshots);

  const snapshot = target ? selectSnapshot(snapshots, target) : null;
  const comparison = buildComparisonSet({
    subject: video,
    target: target ?? 'current',
    subjectSnapshot: snapshot,
    candidates,
  });
  const benchmarks = benchmarkMetrics(snapshot, comparison, ALL_METRIC_KEYS);
  const score = computePerformanceScore(benchmarks);

  return {
    video,
    ageHours,
    target,
    availableTargets: targets,
    snapshot,
    snapshots,
    comparison,
    benchmarks,
    score,
    dataQualityNotes: buildDataQualityNotes({ video, snapshot, comparison }),
  };
}

function buildDataQualityNotes(params: {
  video: Video;
  snapshot: AnalyticsSnapshot | null;
  comparison: ComparisonSet;
}): string[] {
  const { video, snapshot, comparison } = params;
  const notes: string[] = [];

  if (!video.classification.benchmarkEligible) {
    notes.push(
      `הסרטון סווג כ"${contentTypeLabel(video.classification.contentType)}" (${classificationSourceLabel(
        video.classification.source,
      )}), ולכן הוא לא נכלל בהשוואות מול סרטונים רגילים.`,
    );
  }

  if (snapshot?.snapshotSource === 'daily_backfill') {
    notes.push(
      'הנתונים בנקודה הזו שוחזרו מדיווח יומי של YouTube. זהו קירוב ברמת יום, לא מדידה בגיל המדויק של הסרטון.',
    );
  }

  if (!comparison.hasEnoughData) {
    notes.push(INSUFFICIENT_BENCHMARK_MESSAGE_HE);
    if (comparison.sampleSize > 0) {
      notes.push(`נמצאו ${comparison.sampleSize} סרטונים דומים בלבד באותה נקודת זמן.`);
    }
  } else if (comparison.quality !== 'milestone') {
    notes.push(
      'חלק מסרטוני ההשוואה מבוססים על שחזור מנתונים יומיים, ולכן ההשוואה מדויקת פחות.',
    );
  }

  return notes;
}

/** Convenience accessor used across the UI. */
export function benchmarkOf(
  analysis: VideoAnalysis,
  key: BenchmarkMetricKey,
): MetricBenchmark | null {
  return analysis.benchmarks[key] ?? null;
}
