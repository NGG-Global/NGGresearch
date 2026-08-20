import { classifyVideo } from '@/lib/domain/classification';
import { metricFrom, pendingMetric } from '@/lib/domain/metric';
import type {
  AnalyticsSnapshot,
  Channel,
  ContentType,
  DailyMetric,
  Insight,
  SnapshotMetrics,
  SnapshotSource,
  SnapshotTarget,
  SyncRun,
  TokenStatus,
  Video,
} from '@/lib/domain/types';
import { validateInsightPayload } from '@/lib/insights/schema';

/** PostgREST returns numeric/bigint columns as numbers, but be defensive. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function iso(value: unknown): string {
  if (typeof value === 'string') return value;
  return new Date(0).toISOString();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function mapChannel(row: Row, tokenStatus: TokenStatus = 'missing'): Channel {
  return {
    id: str(row.id),
    youtubeChannelId: str(row.youtube_channel_id),
    title: str(row.title),
    avatarUrl: row.avatar_url ?? null,
    subscriberCount: num(row.subscriber_count),
    videoCount: num(row.video_count),
    viewCount: num(row.view_count),
    connectedAt: iso(row.connected_at),
    lastSuccessfulSyncAt: row.last_successful_sync_at ? iso(row.last_successful_sync_at) : null,
    tokenStatus,
  };
}

export function mapVideo(row: Row): Video {
  const override = (row.content_type_override ?? null) as ContentType | null;
  // Recompute the classification from stored inputs so the rules live in one
  // place; the persisted columns are a cache, not the source of truth.
  const classification = override
    ? classifyVideo({ durationSeconds: num(row.duration_seconds), manualOverride: override })
    : {
        contentType: (row.content_type ?? 'unknown') as ContentType,
        source: row.classification_source ?? 'unknown',
        confidence: row.classification_confidence ?? 'low',
        benchmarkEligible: Boolean(row.benchmark_eligible),
      };

  return {
    id: str(row.id),
    channelId: str(row.channel_id),
    youtubeVideoId: str(row.youtube_video_id),
    title: str(row.title),
    description: str(row.description),
    thumbnailUrl: row.thumbnail_url ?? null,
    publishedAt: iso(row.published_at),
    durationSeconds: num(row.duration_seconds),
    privacyStatus: row.privacy_status ?? 'unknown',
    url: str(row.url, `https://www.youtube.com/watch?v=${str(row.youtube_video_id)}`),
    classification,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const REACH_PENDING_NOTE = 'ממתין לדוח חשיפות של YouTube';

export function mapSnapshotMetrics(row: Row): SnapshotMetrics {
  return {
    views: metricFrom(num(row.views)),
    watchTimeMinutes: metricFrom(num(row.watch_time_minutes)),
    averageViewDurationSeconds: metricFrom(num(row.average_view_duration_seconds)),
    averageViewPercentage: metricFrom(num(row.average_view_percentage)),
    subscribersGained: metricFrom(num(row.subscribers_gained)),
    subscribersLost: metricFrom(num(row.subscribers_lost)),
    likes: metricFrom(num(row.likes)),
    comments: metricFrom(num(row.comments)),
    impressions: metricFrom(num(row.impressions), pendingMetric(REACH_PENDING_NOTE)),
    impressionsCtr: metricFrom(num(row.impressions_ctr), pendingMetric(REACH_PENDING_NOTE)),
  };
}

export function mapSnapshot(row: Row): AnalyticsSnapshot {
  return {
    id: str(row.id),
    videoId: str(row.video_id),
    capturedAt: iso(row.captured_at),
    videoAgeHours: num(row.video_age_hours) ?? 0,
    snapshotTarget: (row.snapshot_target ?? 'current') as SnapshotTarget,
    snapshotSource: (row.snapshot_source ?? 'current_state') as SnapshotSource,
    metrics: mapSnapshotMetrics(row),
  };
}

export function mapDailyMetric(row: Row): DailyMetric {
  return {
    videoId: str(row.video_id),
    date: str(row.date),
    views: num(row.views) ?? 0,
    watchTimeMinutes: num(row.watch_time_minutes),
    averageViewDurationSeconds: num(row.average_view_duration_seconds),
    averageViewPercentage: num(row.average_view_percentage),
    subscribersGained: num(row.subscribers_gained),
    subscribersLost: num(row.subscribers_lost),
    likes: num(row.likes),
    comments: num(row.comments),
    impressions: num(row.impressions),
    impressionsCtr: num(row.impressions_ctr),
  };
}

/** Stored insight payloads are re-validated on read; invalid rows are dropped. */
export function mapInsight(row: Row): Insight | null {
  const validation = validateInsightPayload(row.payload);
  if (!validation.ok || !validation.payload) return null;
  return {
    id: str(row.id),
    videoId: str(row.video_id),
    snapshotTarget: (row.snapshot_target ?? 'current') as SnapshotTarget,
    generatedAt: iso(row.generated_at),
    provider: row.provider === 'anthropic' ? 'anthropic' : 'rules',
    model: row.model ?? null,
    payload: validation.payload,
  };
}

export function mapSyncRun(row: Row): SyncRun {
  return {
    id: str(row.id),
    channelId: str(row.channel_id),
    trigger: row.trigger ?? 'manual',
    status: row.status ?? 'running',
    startedAt: iso(row.started_at),
    finishedAt: row.finished_at ? iso(row.finished_at) : null,
    durationMs: num(row.duration_ms),
    videosProcessed: num(row.videos_processed) ?? 0,
    snapshotsCreated: num(row.snapshots_created) ?? 0,
    warnings: Array.isArray(row.warnings) ? row.warnings.map((w: unknown) => str(w)) : [],
    error: row.error ?? null,
  };
}
