import { classifyVideo } from '@/lib/domain/classification';
import { availableMetric, pendingMetric } from '@/lib/domain/metric';
import { enabledMilestones, videoAgeHours } from '@/lib/domain/snapshots';
import type {
  AnalyticsSnapshot,
  Channel,
  DailyMetric,
  SnapshotMetrics,
  SnapshotSource,
  SnapshotTarget,
  SyncRun,
  Video,
} from '@/lib/domain/types';
import { toDateString } from '@/lib/sync/dates';
import {
  DEMO_CHANNEL,
  DEMO_VIDEOS,
  MILESTONE_ACCUMULATION,
  type DemoVideoSpec,
} from './fixtures';

const REACH_PENDING_NOTE = 'ממתין לדוח חשיפות של YouTube';
const HOURS_PAST_MIDNIGHT = 6;
/** Days of per-day history generated per video, for the performance chart. */
const DAILY_HISTORY_DAYS = 30;

export interface DemoDataset {
  readonly channel: Channel;
  readonly videos: readonly Video[];
  readonly snapshots: ReadonlyMap<string, readonly AnalyticsSnapshot[]>;
  readonly daily: ReadonlyMap<string, readonly DailyMetric[]>;
  readonly lastSyncRun: SyncRun;
}

export function buildDemoDataset(now: Date = new Date()): DemoDataset {
  const channelId = 'demo-channel';
  const videos: Video[] = [];
  const snapshots = new Map<string, readonly AnalyticsSnapshot[]>();
  const daily = new Map<string, readonly DailyMetric[]>();

  for (const spec of DEMO_VIDEOS) {
    const publishedAt = new Date(
      now.getTime() - (spec.publishedDaysAgo * 24 + HOURS_PAST_MIDNIGHT) * 3_600_000,
    );
    const video = buildVideo(spec, channelId, publishedAt, now);
    videos.push(video);
    snapshots.set(video.id, buildSnapshots(spec, video, now));
    daily.set(video.id, buildDailyMetrics(spec, video, now));
  }

  videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return {
    channel: {
      id: channelId,
      youtubeChannelId: DEMO_CHANNEL.youtubeChannelId,
      title: DEMO_CHANNEL.title,
      avatarUrl: DEMO_CHANNEL.avatarUrl,
      subscriberCount: DEMO_CHANNEL.subscriberCount,
      videoCount: DEMO_CHANNEL.videoCount,
      viewCount: DEMO_CHANNEL.viewCount,
      connectedAt: new Date(now.getTime() - 120 * 24 * 3_600_000).toISOString(),
      lastSuccessfulSyncAt: new Date(now.getTime() - 14 * 60_000).toISOString(),
      tokenStatus: 'valid',
    },
    videos,
    snapshots,
    daily,
    lastSyncRun: {
      id: 'demo-sync-run',
      channelId,
      trigger: 'scheduled',
      status: 'success',
      startedAt: new Date(now.getTime() - 15 * 60_000).toISOString(),
      finishedAt: new Date(now.getTime() - 14 * 60_000).toISOString(),
      durationMs: 42_000,
      videosProcessed: DEMO_VIDEOS.length,
      snapshotsCreated: 3,
      warnings: [],
      error: null,
    },
  };
}

function buildVideo(
  spec: DemoVideoSpec,
  channelId: string,
  publishedAt: Date,
  now: Date,
): Video {
  const classification = classifyVideo({
    durationSeconds: spec.durationSeconds,
    // The demo data knows its own content types; live data infers them.
    shortsProbe: spec.contentType === 'short' ? true : null,
    isLiveBroadcast: spec.contentType === 'live' ? true : null,
  });

  return {
    id: spec.youtubeVideoId,
    channelId,
    youtubeVideoId: spec.youtubeVideoId,
    title: spec.title,
    description: spec.description,
    // Demo mode renders the design's gradient thumbnail placeholder.
    thumbnailUrl: null,
    publishedAt: publishedAt.toISOString(),
    durationSeconds: spec.durationSeconds,
    privacyStatus: 'public',
    url: `https://www.youtube.com/watch?v=${spec.youtubeVideoId}`,
    classification,
    createdAt: publishedAt.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function buildSnapshots(
  spec: DemoVideoSpec,
  video: Video,
  now: Date,
): readonly AnalyticsSnapshot[] {
  const ageHours = videoAgeHours(video.publishedAt, now);
  const result: AnalyticsSnapshot[] = [
    {
      id: `${video.id}:current`,
      videoId: video.id,
      capturedAt: now.toISOString(),
      videoAgeHours: ageHours,
      snapshotTarget: 'current',
      snapshotSource: 'current_state',
      metrics: metricsAtFraction(spec, 1),
    },
  ];

  if (spec.snapshotStyle === 'too_new') return result;

  const source: SnapshotSource =
    spec.snapshotStyle === 'backfilled' ? 'daily_backfill' : 'milestone_capture';

  for (const milestone of enabledMilestones()) {
    if (ageHours < milestone.ageHours) continue;
    const fraction = MILESTONE_ACCUMULATION[milestone.target as keyof typeof MILESTONE_ACCUMULATION];
    if (fraction === undefined) continue;

    result.push({
      id: `${video.id}:${milestone.target}`,
      videoId: video.id,
      capturedAt: new Date(
        new Date(video.publishedAt).getTime() + milestone.ageHours * 3_600_000,
      ).toISOString(),
      videoAgeHours: source === 'daily_backfill' ? milestone.ageHours : milestone.ageHours + 1.5,
      snapshotTarget: milestone.target as SnapshotTarget,
      snapshotSource: source,
      metrics: metricsAtFraction(spec, fraction),
    });
  }

  return result;
}

/**
 * Scales lifetime figures back to an earlier point. Rates (retention, CTR) are
 * shifted slightly rather than scaled, because they do not accumulate.
 */
function metricsAtFraction(spec: DemoVideoSpec, fraction: number): SnapshotMetrics {
  const views = Math.round(spec.views * fraction);
  const averageViewPercentage = spec.averageViewPercentage * (fraction < 1 ? 1.04 : 1);
  const averageViewDurationSeconds =
    (spec.durationSeconds * averageViewPercentage) / 100;
  const watchTimeMinutes = (views * averageViewDurationSeconds) / 60;

  const reachAvailable = spec.impressions !== null && spec.impressionsCtr !== null;

  return {
    views: availableMetric(views),
    watchTimeMinutes: availableMetric(Math.round(watchTimeMinutes)),
    averageViewDurationSeconds: availableMetric(Math.round(averageViewDurationSeconds)),
    averageViewPercentage: availableMetric(Number(averageViewPercentage.toFixed(1))),
    subscribersGained: availableMetric(Math.round(spec.subscribersGained * fraction)),
    subscribersLost: availableMetric(Math.round(spec.subscribersLost * fraction)),
    likes: availableMetric(Math.round(spec.likes * fraction)),
    comments: availableMetric(Math.round(spec.comments * fraction)),
    impressions: reachAvailable
      ? availableMetric(Math.round(spec.impressions! * fraction))
      : pendingMetric(REACH_PENDING_NOTE),
    impressionsCtr: reachAvailable
      ? availableMetric(spec.impressionsCtr!)
      : pendingMetric(REACH_PENDING_NOTE),
  };
}

/**
 * A decaying daily view curve that sums to the lifetime total. Deterministic:
 * the weights depend only on the day index.
 */
function buildDailyMetrics(spec: DemoVideoSpec, video: Video, now: Date): readonly DailyMetric[] {
  const publishedAt = new Date(video.publishedAt);
  const ageDays = Math.max(
    1,
    Math.min(DAILY_HISTORY_DAYS, Math.floor(videoAgeHours(video.publishedAt, now) / 24) + 1),
  );

  const weights = Array.from({ length: ageDays }, (_, index) => Math.exp(-index / 3.2));
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  // Only the share of lifetime views that fell inside the generated window.
  const windowShare = ageDays >= DAILY_HISTORY_DAYS ? 0.92 : 1;

  const rows: DailyMetric[] = [];
  for (let index = 0; index < ageDays; index += 1) {
    const date = new Date(publishedAt.getTime() + index * 24 * 3_600_000);
    if (date.getTime() > now.getTime()) break;

    const views = Math.round((spec.views * windowShare * weights[index]!) / weightTotal);
    const averageViewDurationSeconds = Math.round(
      (spec.durationSeconds * spec.averageViewPercentage) / 100,
    );
    const reachAvailable = spec.impressions !== null && spec.impressionsCtr !== null;

    rows.push({
      videoId: video.id,
      date: toDateString(date),
      views,
      watchTimeMinutes: Math.round((views * averageViewDurationSeconds) / 60),
      averageViewDurationSeconds,
      averageViewPercentage: spec.averageViewPercentage,
      subscribersGained: Math.round((spec.subscribersGained * views) / Math.max(1, spec.views)),
      subscribersLost: Math.round((spec.subscribersLost * views) / Math.max(1, spec.views)),
      likes: Math.round((spec.likes * views) / Math.max(1, spec.views)),
      comments: Math.round((spec.comments * views) / Math.max(1, spec.views)),
      impressions: reachAvailable
        ? Math.round((spec.impressions! * views) / Math.max(1, spec.views))
        : null,
      impressionsCtr: reachAvailable ? spec.impressionsCtr : null,
    });
  }

  return rows;
}
