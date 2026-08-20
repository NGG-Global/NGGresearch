import { metricNumber } from '@/lib/domain/metric';
import type { MetricState } from '@/lib/domain/metric';
import { selectSnapshot } from '@/lib/domain/snapshots';
import type { AnalyticsSnapshot, SnapshotTarget, Video } from '@/lib/domain/types';
import { readMetric, type BenchmarkMetricKey, metricDefinition } from './metrics';
import {
  median,
  percentDifference,
  percentileRank,
  robustZScore,
} from './statistics';
import {
  DISPERSION_STANDOUT_Z,
  MAX_BENCHMARK_PEERS,
  MIN_BENCHMARK_SAMPLE,
  MIN_SAMPLE_FOR_DISPERSION,
  statusFromPercentDifference,
  type PerformanceStatus,
} from './thresholds';

export interface BenchmarkCandidate {
  readonly video: Video;
  readonly snapshots: readonly AnalyticsSnapshot[];
}

/**
 * How comparable the peer data is.
 *  - milestone   — subject and all peers are real milestone captures
 *  - mixed       — some peers are daily-backfill approximations
 *  - approximate — nothing in the set is a real milestone capture
 */
export type ComparisonQuality = 'milestone' | 'mixed' | 'approximate';

export type PeerExclusionReason =
  | 'not_benchmark_eligible'
  | 'different_content_type'
  | 'published_after_subject'
  | 'no_snapshot_for_target';

export interface ComparisonPeer {
  readonly video: Video;
  readonly snapshot: AnalyticsSnapshot;
}

export interface ComparisonSet {
  readonly target: SnapshotTarget;
  readonly peers: readonly ComparisonPeer[];
  readonly sampleSize: number;
  readonly quality: ComparisonQuality;
  readonly subjectEligible: boolean;
  readonly hasEnoughData: boolean;
  readonly exclusions: Readonly<Record<PeerExclusionReason, number>>;
}

export interface MetricBenchmark {
  readonly metric: BenchmarkMetricKey;
  readonly value: number | null;
  readonly metricState: MetricState;
  readonly benchmark: number | null;
  readonly percentDifference: number | null;
  readonly sampleSize: number;
  readonly status: PerformanceStatus;
  readonly quality: ComparisonQuality;
  readonly percentileRank: number | null;
  readonly robustZScore: number | null;
  /**
   * True when the value sits far enough from the peer median relative to the
   * peer spread to be worth calling out. Deliberately *not* described as
   * statistical significance anywhere in the UI.
   */
  readonly standsOutFromSpread: boolean;
  readonly higherIsBetter: boolean;
}

/**
 * Builds the set of previous comparable videos for one subject video at one
 * milestone. Only videos of the same content type that are benchmark-eligible
 * and were published before the subject can take part.
 */
export function buildComparisonSet(params: {
  subject: Video;
  target: SnapshotTarget;
  subjectSnapshot: AnalyticsSnapshot | null;
  candidates: readonly BenchmarkCandidate[];
  maxPeers?: number;
}): ComparisonSet {
  const { subject, target, subjectSnapshot, candidates } = params;
  const maxPeers = params.maxPeers ?? MAX_BENCHMARK_PEERS;

  const exclusions: Record<PeerExclusionReason, number> = {
    not_benchmark_eligible: 0,
    different_content_type: 0,
    published_after_subject: 0,
    no_snapshot_for_target: 0,
  };

  const subjectEligible = subject.classification.benchmarkEligible;
  const subjectPublished = new Date(subject.publishedAt).getTime();
  const eligible: ComparisonPeer[] = [];

  for (const candidate of candidates) {
    if (candidate.video.id === subject.id) continue;

    if (!candidate.video.classification.benchmarkEligible) {
      exclusions.not_benchmark_eligible += 1;
      continue;
    }
    if (candidate.video.classification.contentType !== subject.classification.contentType) {
      exclusions.different_content_type += 1;
      continue;
    }
    if (new Date(candidate.video.publishedAt).getTime() >= subjectPublished) {
      exclusions.published_after_subject += 1;
      continue;
    }
    const snapshot = selectSnapshot(candidate.snapshots, target);
    if (!snapshot) {
      exclusions.no_snapshot_for_target += 1;
      continue;
    }
    eligible.push({ video: candidate.video, snapshot });
  }

  eligible.sort(
    (a, b) =>
      new Date(b.video.publishedAt).getTime() - new Date(a.video.publishedAt).getTime(),
  );

  // Prefer like-for-like quality: if there are enough real milestone captures,
  // do not dilute the benchmark with day-granularity approximations.
  const milestonePeers = eligible.filter((p) => p.snapshot.snapshotSource === 'milestone_capture');
  const pool = milestonePeers.length >= MIN_BENCHMARK_SAMPLE ? milestonePeers : eligible;
  const peers = pool.slice(0, maxPeers);

  return {
    target,
    peers,
    sampleSize: peers.length,
    quality: assessQuality(subjectSnapshot, peers),
    subjectEligible,
    hasEnoughData: subjectEligible && peers.length >= MIN_BENCHMARK_SAMPLE,
    exclusions,
  };
}

function assessQuality(
  subjectSnapshot: AnalyticsSnapshot | null,
  peers: readonly ComparisonPeer[],
): ComparisonQuality {
  if (peers.length === 0) return 'approximate';
  const sources = peers.map((p) => p.snapshot.snapshotSource);
  if (subjectSnapshot) sources.push(subjectSnapshot.snapshotSource);
  const milestones = sources.filter((s) => s === 'milestone_capture').length;
  if (milestones === sources.length) return 'milestone';
  if (milestones === 0) return 'approximate';
  return 'mixed';
}

/** Benchmarks one metric of the subject snapshot against the comparison set. */
export function benchmarkMetric(
  subjectSnapshot: AnalyticsSnapshot | null,
  set: ComparisonSet,
  key: BenchmarkMetricKey,
): MetricBenchmark {
  const definition = metricDefinition(key);
  const subjectMetric = subjectSnapshot ? readMetric(subjectSnapshot.metrics, key) : null;
  const value = subjectMetric ? metricNumber(subjectMetric) : null;
  const metricState: MetricState = subjectMetric?.state ?? 'unavailable';

  const peerValues = set.peers
    .map((peer) => metricNumber(readMetric(peer.snapshot.metrics, key)))
    .filter((v): v is number => v !== null);

  const sampleSize = peerValues.length;
  const benchmark = median(peerValues);
  const enough = set.subjectEligible && sampleSize >= MIN_BENCHMARK_SAMPLE;

  const difference =
    value !== null && benchmark !== null && enough ? percentDifference(value, benchmark) : null;

  const z =
    value !== null && sampleSize >= MIN_SAMPLE_FOR_DISPERSION
      ? robustZScore(value, peerValues)
      : null;

  return {
    metric: key,
    value,
    metricState,
    benchmark: enough ? benchmark : null,
    percentDifference: difference,
    sampleSize,
    status: enough ? statusFromPercentDifference(difference, definition.higherIsBetter) : 'insufficient_data',
    quality: set.quality,
    percentileRank: value !== null && enough ? percentileRank(value, peerValues) : null,
    robustZScore: z,
    standsOutFromSpread: z !== null && Math.abs(z) >= DISPERSION_STANDOUT_Z,
    higherIsBetter: definition.higherIsBetter,
  };
}

export function benchmarkMetrics(
  subjectSnapshot: AnalyticsSnapshot | null,
  set: ComparisonSet,
  keys: readonly BenchmarkMetricKey[],
): Record<string, MetricBenchmark> {
  const result: Record<string, MetricBenchmark> = {};
  for (const key of keys) {
    result[key] = benchmarkMetric(subjectSnapshot, set, key);
  }
  return result;
}
