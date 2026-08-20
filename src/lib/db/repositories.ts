import 'server-only';
import type {
  AnalyticsSnapshot,
  Channel,
  ContentType,
  DailyMetric,
  Insight,
  InsightPayload,
  InsightProvider,
  SnapshotSource,
  SnapshotTarget,
  SyncRun,
  SyncStatus,
  SyncTrigger,
  TokenStatus,
  Video,
} from '@/lib/domain/types';
import type { ContentClassification, PrivacyStatus } from '@/lib/domain/types';
import { db } from './client';
import { decryptSecret, encryptSecret } from './crypto';
import {
  mapChannel,
  mapDailyMetric,
  mapInsight,
  mapSnapshot,
  mapSyncRun,
  mapVideo,
} from './mappers';

/* ------------------------------------------------------------------ channel */

export interface ChannelUpsertInput {
  youtubeChannelId: string;
  title: string;
  avatarUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
}

export async function getChannel(): Promise<Channel | null> {
  const { data, error } = await db()
    .from('channels')
    .select('*')
    .order('connected_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`Failed to load channel: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;

  const { data: credential } = await db()
    .from('channel_credentials')
    .select('token_status')
    .eq('channel_id', row.id)
    .maybeSingle();

  return mapChannel(row, (credential?.token_status as TokenStatus | undefined) ?? 'missing');
}

export async function upsertChannel(input: ChannelUpsertInput): Promise<Channel> {
  const { data, error } = await db()
    .from('channels')
    .upsert(
      {
        youtube_channel_id: input.youtubeChannelId,
        title: input.title,
        avatar_url: input.avatarUrl,
        subscriber_count: input.subscriberCount,
        video_count: input.videoCount,
        view_count: input.viewCount,
      },
      { onConflict: 'youtube_channel_id' },
    )
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to save channel: ${error?.message ?? 'no row'}`);
  return mapChannel(data, 'valid');
}

export async function markLastSuccessfulSync(channelId: string, at: Date): Promise<void> {
  const { error } = await db()
    .from('channels')
    .update({ last_successful_sync_at: at.toISOString() })
    .eq('id', channelId);
  if (error) throw new Error(`Failed to record sync time: ${error.message}`);
}

export async function deleteChannel(channelId: string): Promise<void> {
  const { error } = await db().from('channels').delete().eq('id', channelId);
  if (error) throw new Error(`Failed to disconnect channel: ${error.message}`);
}

/* -------------------------------------------------------------- credentials */

export interface StoredCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string | null;
  tokenStatus: TokenStatus;
}

export async function saveCredentials(
  channelId: string,
  input: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date | null;
    scope?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    channel_id: channelId,
    access_token_encrypted: encryptSecret(input.accessToken),
    token_expires_at: input.expiresAt?.toISOString() ?? null,
    token_status: 'valid',
  };
  if (input.scope) patch.scope = input.scope;
  // Google only returns a refresh token on the first consent; never overwrite a
  // stored one with null.
  if (input.refreshToken) patch.refresh_token_encrypted = encryptSecret(input.refreshToken);

  const { error } = await db().from('channel_credentials').upsert(patch, { onConflict: 'channel_id' });
  if (error) throw new Error(`Failed to save credentials: ${error.message}`);
}

export async function getCredentials(channelId: string): Promise<StoredCredentials | null> {
  const { data, error } = await db()
    .from('channel_credentials')
    .select('*')
    .eq('channel_id', channelId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load credentials: ${error.message}`);
  if (!data) return null;

  return {
    accessToken: data.access_token_encrypted ? decryptSecret(data.access_token_encrypted) : null,
    refreshToken: data.refresh_token_encrypted ? decryptSecret(data.refresh_token_encrypted) : null,
    expiresAt: data.token_expires_at ?? null,
    scope: data.scope ?? null,
    tokenStatus: (data.token_status as TokenStatus) ?? 'missing',
  };
}

export async function markTokenStatus(channelId: string, status: TokenStatus): Promise<void> {
  const { error } = await db()
    .from('channel_credentials')
    .update({ token_status: status })
    .eq('channel_id', channelId);
  if (error) throw new Error(`Failed to update token status: ${error.message}`);
}

/* --------------------------------------------------------------------- video */

export interface VideoUpsertInput {
  youtubeVideoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  durationSeconds: number | null;
  privacyStatus: PrivacyStatus;
  url: string;
  classification: ContentClassification;
}

export async function listVideos(channelId: string): Promise<Video[]> {
  const { data, error } = await db()
    .from('videos')
    .select('*')
    .eq('channel_id', channelId)
    .order('published_at', { ascending: false });
  if (error) throw new Error(`Failed to load videos: ${error.message}`);
  return (data ?? []).map(mapVideo);
}

export async function getVideoById(id: string): Promise<Video | null> {
  const { data, error } = await db().from('videos').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load video: ${error.message}`);
  return data ? mapVideo(data) : null;
}

export async function getVideoByYoutubeId(youtubeVideoId: string): Promise<Video | null> {
  const { data, error } = await db()
    .from('videos')
    .select('*')
    .eq('youtube_video_id', youtubeVideoId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load video: ${error.message}`);
  return data ? mapVideo(data) : null;
}

/**
 * Idempotent by `youtube_video_id`: re-running a sync updates metadata in place
 * and never inserts the same video twice.
 */
export async function upsertVideos(
  channelId: string,
  inputs: readonly VideoUpsertInput[],
): Promise<Video[]> {
  if (inputs.length === 0) return [];
  const rows = inputs.map((input) => ({
    channel_id: channelId,
    youtube_video_id: input.youtubeVideoId,
    title: input.title,
    description: input.description,
    thumbnail_url: input.thumbnailUrl,
    published_at: input.publishedAt,
    duration_seconds: input.durationSeconds,
    privacy_status: input.privacyStatus,
    url: input.url,
    content_type: input.classification.contentType,
    classification_source: input.classification.source,
    classification_confidence: input.classification.confidence,
    benchmark_eligible: input.classification.benchmarkEligible,
  }));

  const { data, error } = await db()
    .from('videos')
    .upsert(rows, { onConflict: 'youtube_video_id' })
    .select('*');
  if (error) throw new Error(`Failed to save videos: ${error.message}`);
  return (data ?? []).map(mapVideo);
}

export async function setContentTypeOverride(
  videoId: string,
  override: ContentType | null,
): Promise<void> {
  const { error } = await db()
    .from('videos')
    .update({ content_type_override: override })
    .eq('id', videoId);
  if (error) throw new Error(`Failed to override content type: ${error.message}`);
}

/* ----------------------------------------------------------------- snapshots */

export interface SnapshotUpsertInput {
  videoId: string;
  capturedAt: Date;
  videoAgeHours: number;
  snapshotTarget: SnapshotTarget;
  snapshotSource: SnapshotSource;
  views: number | null;
  watchTimeMinutes: number | null;
  averageViewDurationSeconds: number | null;
  averageViewPercentage: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
  likes: number | null;
  comments: number | null;
  impressions: number | null;
  impressionsCtr: number | null;
}

export interface SnapshotUpsertResult {
  snapshot: AnalyticsSnapshot;
  created: boolean;
}

/**
 * Upserts on (video_id, snapshot_target, snapshot_source). Running the same
 * sync twice refreshes the row instead of creating a second snapshot for the
 * same measurement point.
 */
export async function upsertSnapshot(input: SnapshotUpsertInput): Promise<SnapshotUpsertResult> {
  const { data: existing } = await db()
    .from('analytics_snapshots')
    .select('id')
    .eq('video_id', input.videoId)
    .eq('snapshot_target', input.snapshotTarget)
    .eq('snapshot_source', input.snapshotSource)
    .maybeSingle();

  const { data, error } = await db()
    .from('analytics_snapshots')
    .upsert(
      {
        video_id: input.videoId,
        captured_at: input.capturedAt.toISOString(),
        video_age_hours: Number(input.videoAgeHours.toFixed(2)),
        snapshot_target: input.snapshotTarget,
        snapshot_source: input.snapshotSource,
        views: input.views,
        watch_time_minutes: input.watchTimeMinutes,
        average_view_duration_seconds: input.averageViewDurationSeconds,
        average_view_percentage: input.averageViewPercentage,
        subscribers_gained: input.subscribersGained,
        subscribers_lost: input.subscribersLost,
        likes: input.likes,
        comments: input.comments,
        impressions: input.impressions,
        impressions_ctr: input.impressionsCtr,
      },
      { onConflict: 'video_id,snapshot_target,snapshot_source' },
    )
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to save snapshot: ${error?.message ?? 'no row'}`);

  return { snapshot: mapSnapshot(data), created: !existing };
}

export async function listSnapshotsForVideo(videoId: string): Promise<AnalyticsSnapshot[]> {
  const { data, error } = await db()
    .from('analytics_snapshots')
    .select('*')
    .eq('video_id', videoId)
    .order('captured_at', { ascending: true });
  if (error) throw new Error(`Failed to load snapshots: ${error.message}`);
  return (data ?? []).map(mapSnapshot);
}

/** All snapshots for a channel, grouped by video id. One round trip. */
export async function listSnapshotsByVideo(
  videoIds: readonly string[],
): Promise<Map<string, AnalyticsSnapshot[]>> {
  const grouped = new Map<string, AnalyticsSnapshot[]>();
  if (videoIds.length === 0) return grouped;

  const { data, error } = await db()
    .from('analytics_snapshots')
    .select('*')
    .in('video_id', videoIds as string[]);
  if (error) throw new Error(`Failed to load snapshots: ${error.message}`);

  for (const row of data ?? []) {
    const snapshot = mapSnapshot(row);
    const bucket = grouped.get(snapshot.videoId);
    if (bucket) bucket.push(snapshot);
    else grouped.set(snapshot.videoId, [snapshot]);
  }
  return grouped;
}

/* ------------------------------------------------------------ daily metrics */

export async function upsertDailyMetrics(rows: readonly DailyMetric[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error, data } = await db()
    .from('daily_metrics')
    .upsert(
      rows.map((row) => ({
        video_id: row.videoId,
        date: row.date,
        views: row.views,
        watch_time_minutes: row.watchTimeMinutes,
        average_view_duration_seconds: row.averageViewDurationSeconds,
        average_view_percentage: row.averageViewPercentage,
        subscribers_gained: row.subscribersGained,
        subscribers_lost: row.subscribersLost,
        likes: row.likes,
        comments: row.comments,
        impressions: row.impressions,
        impressions_ctr: row.impressionsCtr,
      })),
      { onConflict: 'video_id,date' },
    )
    .select('video_id');
  if (error) throw new Error(`Failed to save daily metrics: ${error.message}`);
  return data?.length ?? 0;
}

export async function listDailyMetrics(videoId: string): Promise<DailyMetric[]> {
  const { data, error } = await db()
    .from('daily_metrics')
    .select('*')
    .eq('video_id', videoId)
    .order('date', { ascending: true });
  if (error) throw new Error(`Failed to load daily metrics: ${error.message}`);
  return (data ?? []).map(mapDailyMetric);
}

export async function listDailyMetricsForVideos(
  videoIds: readonly string[],
): Promise<Map<string, DailyMetric[]>> {
  const grouped = new Map<string, DailyMetric[]>();
  if (videoIds.length === 0) return grouped;
  const { data, error } = await db()
    .from('daily_metrics')
    .select('*')
    .in('video_id', videoIds as string[])
    .order('date', { ascending: true });
  if (error) throw new Error(`Failed to load daily metrics: ${error.message}`);
  for (const row of data ?? []) {
    const metric = mapDailyMetric(row);
    const bucket = grouped.get(metric.videoId);
    if (bucket) bucket.push(metric);
    else grouped.set(metric.videoId, [metric]);
  }
  return grouped;
}

/* ------------------------------------------------------------------ insights */

export async function getInsight(
  videoId: string,
  target: SnapshotTarget,
): Promise<Insight | null> {
  const { data, error } = await db()
    .from('insights')
    .select('*')
    .eq('video_id', videoId)
    .eq('snapshot_target', target)
    .maybeSingle();
  if (error) throw new Error(`Failed to load insight: ${error.message}`);
  return data ? mapInsight(data) : null;
}

export async function saveInsight(input: {
  videoId: string;
  snapshotTarget: SnapshotTarget;
  provider: InsightProvider;
  model: string | null;
  payload: InsightPayload;
}): Promise<Insight | null> {
  const { data, error } = await db()
    .from('insights')
    .upsert(
      {
        video_id: input.videoId,
        snapshot_target: input.snapshotTarget,
        provider: input.provider,
        model: input.model,
        payload: input.payload,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'video_id,snapshot_target' },
    )
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to save insight: ${error?.message ?? 'no row'}`);
  return mapInsight(data);
}

/* ----------------------------------------------------------------- sync runs */

export async function startSyncRun(channelId: string, trigger: SyncTrigger): Promise<string> {
  const { data, error } = await db()
    .from('sync_runs')
    .insert({ channel_id: channelId, trigger, status: 'running' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to open sync run: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

export async function finishSyncRun(
  id: string,
  patch: {
    status: SyncStatus;
    videosProcessed: number;
    snapshotsCreated: number;
    warnings: readonly string[];
    error: string | null;
    startedAt: Date;
  },
): Promise<void> {
  const finishedAt = new Date();
  const { error } = await db()
    .from('sync_runs')
    .update({
      status: patch.status,
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - patch.startedAt.getTime(),
      videos_processed: patch.videosProcessed,
      snapshots_created: patch.snapshotsCreated,
      warnings: patch.warnings,
      error: patch.error,
    })
    .eq('id', id);
  if (error) throw new Error(`Failed to close sync run: ${error.message}`);
}

export async function latestSyncRun(channelId: string): Promise<SyncRun | null> {
  const { data, error } = await db()
    .from('sync_runs')
    .select('*')
    .eq('channel_id', channelId)
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to load sync runs: ${error.message}`);
  const row = data?.[0];
  return row ? mapSyncRun(row) : null;
}

/* ------------------------------------------------------------ reporting jobs */

export async function getReportingJob(
  channelId: string,
  reportTypeId: string,
): Promise<{ jobId: string; lastReportId: string | null } | null> {
  const { data, error } = await db()
    .from('reporting_jobs')
    .select('*')
    .eq('channel_id', channelId)
    .eq('report_type_id', reportTypeId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load reporting job: ${error.message}`);
  return data ? { jobId: data.job_id as string, lastReportId: data.last_report_id ?? null } : null;
}

export async function saveReportingJob(input: {
  channelId: string;
  reportTypeId: string;
  jobId: string;
  lastReportId?: string | null;
}): Promise<void> {
  const { error } = await db()
    .from('reporting_jobs')
    .upsert(
      {
        channel_id: input.channelId,
        report_type_id: input.reportTypeId,
        job_id: input.jobId,
        last_report_id: input.lastReportId ?? null,
        last_report_downloaded_at: input.lastReportId ? new Date().toISOString() : null,
      },
      { onConflict: 'channel_id,report_type_id' },
    );
  if (error) throw new Error(`Failed to save reporting job: ${error.message}`);
}
