import { classifyVideo } from '@/lib/domain/classification';
import { availableMetric, pendingMetric, unavailableMetric } from '@/lib/domain/metric';
import type {
  AnalyticsSnapshot,
  SnapshotMetrics,
  SnapshotSource,
  SnapshotTarget,
  Video,
} from '@/lib/domain/types';

export const NOW = new Date('2026-08-20T12:00:00.000Z');

export interface MetricOverrides {
  views?: number | null;
  averageViewPercentage?: number | null;
  averageViewDurationSeconds?: number | null;
  watchTimeMinutes?: number | null;
  subscribersGained?: number | null;
  subscribersLost?: number | null;
  likes?: number | null;
  comments?: number | null;
  impressions?: number | null;
  impressionsCtr?: number | null;
  /** Metrics listed here become `unavailable` rather than `pending`. */
  unavailable?: readonly string[];
}

/**
 * Builds snapshot metrics where an explicit `null` means "not known" (pending)
 * and an explicit `0` means a measured zero. Tests rely on that distinction.
 */
export function metrics(overrides: MetricOverrides = {}): SnapshotMetrics {
  const unavailable = new Set(overrides.unavailable ?? []);
  const build = (key: keyof MetricOverrides, value: number | null | undefined) => {
    if (unavailable.has(key)) return unavailableMetric();
    if (value === null || value === undefined) return pendingMetric();
    return availableMetric(value);
  };

  return {
    views: build('views', overrides.views ?? null),
    watchTimeMinutes: build('watchTimeMinutes', overrides.watchTimeMinutes ?? null),
    averageViewDurationSeconds: build(
      'averageViewDurationSeconds',
      overrides.averageViewDurationSeconds ?? null,
    ),
    averageViewPercentage: build('averageViewPercentage', overrides.averageViewPercentage ?? null),
    subscribersGained: build('subscribersGained', overrides.subscribersGained ?? null),
    subscribersLost: build('subscribersLost', overrides.subscribersLost ?? null),
    likes: build('likes', overrides.likes ?? null),
    comments: build('comments', overrides.comments ?? null),
    impressions: build('impressions', overrides.impressions ?? null),
    impressionsCtr: build('impressionsCtr', overrides.impressionsCtr ?? null),
  };
}

export function makeVideo(params: {
  id: string;
  publishedDaysAgo: number;
  durationSeconds?: number;
  contentType?: 'long_form' | 'short' | 'live';
  title?: string;
}): Video {
  const publishedAt = new Date(
    NOW.getTime() - params.publishedDaysAgo * 24 * 3_600_000,
  ).toISOString();
  const durationSeconds = params.durationSeconds ?? 900;
  const contentType = params.contentType ?? 'long_form';

  return {
    id: params.id,
    channelId: 'channel-1',
    youtubeVideoId: params.id,
    title: params.title ?? `סרטון ${params.id}`,
    description: '',
    thumbnailUrl: null,
    publishedAt,
    durationSeconds,
    privacyStatus: 'public',
    url: `https://www.youtube.com/watch?v=${params.id}`,
    classification: classifyVideo({
      durationSeconds,
      shortsProbe: contentType === 'short' ? true : null,
      isLiveBroadcast: contentType === 'live' ? true : null,
    }),
    createdAt: publishedAt,
    updatedAt: publishedAt,
  };
}

export function makeSnapshot(params: {
  videoId: string;
  target: SnapshotTarget;
  source?: SnapshotSource;
  ageHours?: number;
  metrics?: MetricOverrides;
  capturedAt?: string;
}): AnalyticsSnapshot {
  return {
    id: `${params.videoId}:${params.target}:${params.source ?? 'milestone_capture'}`,
    videoId: params.videoId,
    capturedAt: params.capturedAt ?? NOW.toISOString(),
    videoAgeHours: params.ageHours ?? 24,
    snapshotTarget: params.target,
    snapshotSource: params.source ?? 'milestone_capture',
    metrics: metrics(params.metrics ?? {}),
  };
}

/**
 * A peer set of long-form videos with 72h view counts, used to exercise
 * benchmarks with a known median.
 */
export function makePeers(views: readonly number[]) {
  return views.map((value, index) => ({
    video: makeVideo({ id: `peer-${index}`, publishedDaysAgo: 10 + index * 7 }),
    snapshots: [
      makeSnapshot({
        videoId: `peer-${index}`,
        target: 'h72',
        ageHours: 72,
        metrics: {
          views: value,
          averageViewPercentage: 40,
          subscribersGained: Math.round(value / 500),
          impressionsCtr: 6,
          watchTimeMinutes: value * 4,
        },
      }),
    ],
  }));
}
