import 'server-only';
import { syncLimits } from '@/lib/config/env';
import {
  finishSyncRun,
  getChannel,
  listSnapshotsByVideo,
  listVideos,
  markLastSuccessfulSync,
  markTokenStatus,
  startSyncRun,
  upsertChannel,
  upsertDailyMetrics,
  upsertSnapshot,
  upsertVideos,
} from '@/lib/db/repositories';
import { dueMilestones, missedMilestones, videoAgeHours } from '@/lib/domain/snapshots';
import type { AnalyticsSnapshot, DailyMetric, SyncStatus, SyncTrigger, Video } from '@/lib/domain/types';
import { getAccessToken } from '@/lib/youtube/access-token';
import {
  fetchVideoDaily,
  fetchVideoTotals,
  sumDailyRows,
  type VideoAnalyticsDay,
  type VideoAnalyticsTotals,
} from '@/lib/youtube/analytics-api';
import { fetchOwnChannel, fetchUploadedVideoIds, fetchVideoMetadata } from '@/lib/youtube/data-api';
import { YouTubeApiError } from '@/lib/youtube/errors';
import { dateRange, milestoneDayCount, toDateString } from './dates';
import { EMPTY_REACH, loadReachDataset, reachForWindow, type ReachDataset } from './reach';

export interface SyncOptions {
  readonly trigger: SyncTrigger;
  readonly now?: Date;
}

export interface SyncResult {
  readonly status: SyncStatus;
  readonly runId: string | null;
  readonly videosProcessed: number;
  readonly snapshotsCreated: number;
  readonly warnings: readonly string[];
  readonly error: string | null;
  readonly finishedAt: string;
}

/**
 * The one place that talks to YouTube and writes analytics.
 *
 * Every write is an upsert keyed on natural identifiers, so running this twice
 * in a row updates rows instead of duplicating videos or snapshots. The
 * scheduler is deliberately not part of this module — see scheduler.ts.
 */
export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const startedAt = now;
  const warnings: string[] = [];
  let runId: string | null = null;
  let videosProcessed = 0;
  let snapshotsCreated = 0;

  const channel = await getChannel();
  if (!channel) {
    return {
      status: 'failed',
      runId: null,
      videosProcessed: 0,
      snapshotsCreated: 0,
      warnings: [],
      error: 'לא מחובר ערוץ YouTube.',
      finishedAt: new Date().toISOString(),
    };
  }

  try {
    runId = await startSyncRun(channel.id, options.trigger);
    const accessToken = await getAccessToken(channel.id);
    const limits = syncLimits();

    // 1. Channel metadata.
    const metadata = await fetchOwnChannel(accessToken);
    await upsertChannel({
      youtubeChannelId: metadata.youtubeChannelId,
      title: metadata.title,
      avatarUrl: metadata.avatarUrl,
      subscriberCount: metadata.subscriberCount,
      videoCount: metadata.videoCount,
      viewCount: metadata.viewCount,
    });

    // 2. Uploaded videos and their metadata.
    if (!metadata.uploadsPlaylistId) {
      warnings.push('לערוץ אין פלייליסט העלאות, ולכן לא נמשכו סרטונים.');
    } else {
      const ids = await fetchUploadedVideoIds(
        accessToken,
        metadata.uploadsPlaylistId,
        limits.maxMetadataVideos,
      );
      const metadataRows = await fetchVideoMetadata(accessToken, ids);
      await upsertVideos(channel.id, metadataRows);
    }

    const videos = await listVideos(channel.id);
    const snapshotsByVideo = await listSnapshotsByVideo(videos.map((video) => video.id));

    // 3. Reach reports (impressions + CTR). Never fatal.
    let reach: ReachDataset = EMPTY_REACH;
    try {
      reach = await loadReachDataset({ accessToken, channelId: channel.id });
    } catch (error) {
      warnings.push(describeError(error, 'נתוני החשיפות לא נטענו.'));
    }
    warnings.push(...reach.warnings);

    // 4. Per-video analytics, snapshots and daily rows.
    const analyticsTargets = videos.slice(0, limits.maxAnalyticsVideos);
    const dailyTargets = new Set(videos.slice(0, limits.maxDailyVideos).map((v) => v.id));
    const today = toDateString(now);

    for (const video of analyticsTargets) {
      try {
        const existing = snapshotsByVideo.get(video.id) ?? [];
        const created = await syncVideo({
          accessToken,
          video,
          existing,
          reach,
          today,
          now,
          withDaily: dailyTargets.has(video.id),
        });
        snapshotsCreated += created;
        videosProcessed += 1;
      } catch (error) {
        if (error instanceof YouTubeApiError && error.kind === 'auth_expired') throw error;
        warnings.push(`${video.title}: ${describeError(error, 'נתוני האנליטיקס לא נמשכו.')}`);
      }
    }

    await markLastSuccessfulSync(channel.id, new Date());

    const status: SyncStatus = warnings.length > 0 ? 'partial' : 'success';
    await finishSyncRun(runId, {
      status,
      videosProcessed,
      snapshotsCreated,
      warnings,
      error: null,
      startedAt,
    });

    return {
      status,
      runId,
      videosProcessed,
      snapshotsCreated,
      warnings,
      error: null,
      finishedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof YouTubeApiError && error.kind === 'auth_expired') {
      await markTokenStatus(channel.id, 'expired').catch(() => undefined);
    }
    const message = describeError(error, 'הסנכרון נכשל.');
    if (runId) {
      await finishSyncRun(runId, {
        status: 'failed',
        videosProcessed,
        snapshotsCreated,
        warnings,
        error: message,
        startedAt,
      }).catch(() => undefined);
    }
    return {
      status: 'failed',
      runId,
      videosProcessed,
      snapshotsCreated,
      warnings,
      error: message,
      finishedAt: new Date().toISOString(),
    };
  }
}

/** Returns the number of newly created snapshots for this video. */
async function syncVideo(params: {
  accessToken: string;
  video: Video;
  existing: readonly AnalyticsSnapshot[];
  reach: ReachDataset;
  today: string;
  now: Date;
  withDaily: boolean;
}): Promise<number> {
  const { accessToken, video, existing, reach, today, now } = params;
  const publishedDay = video.publishedAt.slice(0, 10);
  const ageHours = videoAgeHours(video.publishedAt, now);
  let created = 0;

  // Lifetime totals as of right now.
  const totals = await fetchVideoTotals({
    accessToken,
    videoId: video.youtubeVideoId,
    startDate: publishedDay,
    endDate: today,
  });

  if (totals) {
    const currentReach = reachForWindow(reach, video.youtubeVideoId, dateRange(publishedDay, today));
    const result = await upsertSnapshot({
      videoId: video.id,
      capturedAt: now,
      videoAgeHours: ageHours,
      snapshotTarget: 'current',
      snapshotSource: 'current_state',
      ...toSnapshotMetrics(totals),
      impressions: currentReach.impressions,
      impressionsCtr: currentReach.impressionsCtr,
    });
    if (result.created) created += 1;

    // Milestone captures: the same lifetime totals, taken while the video's real
    // age falls inside a milestone window. This is a genuine measurement at that
    // age — not a daily row relabelled as one.
    for (const target of dueMilestones(ageHours, existing)) {
      if (totals.views === null) continue; // Analytics not in yet; retry next run.
      const milestoneResult = await upsertSnapshot({
        videoId: video.id,
        capturedAt: now,
        videoAgeHours: ageHours,
        snapshotTarget: target.target,
        snapshotSource: 'milestone_capture',
        ...toSnapshotMetrics(totals),
        impressions: currentReach.impressions,
        impressionsCtr: currentReach.impressionsCtr,
      });
      if (milestoneResult.created) created += 1;
    }
  }

  if (!params.withDaily) return created;

  // Daily rows: used for the performance chart and for honest backfill.
  const daily = await fetchVideoDaily({
    accessToken,
    videoId: video.youtubeVideoId,
    startDate: publishedDay,
    endDate: today,
  });

  if (daily.length > 0) {
    await upsertDailyMetrics(mergeDailyWithReach(video, daily, reach));
    created += await backfillMissedMilestones({ video, ageHours, existing, daily, reach, now });
  }

  return created;
}

/**
 * Approximates milestones whose capture window has already closed.
 *
 * These are explicitly stored as `daily_backfill`: YouTube's daily rows are
 * calendar days, and the first day is partial depending on publication time, so
 * "the first calendar day" is not the same measurement as "the first 24 hours".
 * The benchmarking engine keeps the two apart.
 */
async function backfillMissedMilestones(params: {
  video: Video;
  ageHours: number;
  existing: readonly AnalyticsSnapshot[];
  daily: readonly VideoAnalyticsDay[];
  reach: ReachDataset;
  now: Date;
}): Promise<number> {
  const { video, ageHours, existing, daily, reach, now } = params;
  const publishedDay = video.publishedAt.slice(0, 10);
  let created = 0;

  for (const target of missedMilestones(ageHours, existing)) {
    const dayCount = milestoneDayCount(target.ageHours);
    const window = dateRange(publishedDay, addDaysString(publishedDay, dayCount - 1));
    const rows = daily.filter((row) => window.includes(row.date));
    if (rows.length < dayCount) continue; // Incomplete coverage — do not guess.

    const totals = sumDailyRows(rows);
    if (totals.views === null) continue;

    const windowReach = reachForWindow(reach, video.youtubeVideoId, window);
    const result = await upsertSnapshot({
      videoId: video.id,
      capturedAt: now,
      // The honest age represented by the summed data, not the nominal target.
      videoAgeHours: dayCount * 24,
      snapshotTarget: target.target,
      snapshotSource: 'daily_backfill',
      ...toSnapshotMetrics(totals),
      impressions: windowReach.impressions,
      impressionsCtr: windowReach.impressionsCtr,
    });
    if (result.created) created += 1;
  }

  return created;
}

function mergeDailyWithReach(
  video: Video,
  daily: readonly VideoAnalyticsDay[],
  reach: ReachDataset,
): DailyMetric[] {
  const reachRows = reach.byVideo.get(video.youtubeVideoId);
  return daily.map((row) => {
    const reachDay = reachRows?.get(row.date);
    const covered = reach.coveredDates.has(row.date);
    return {
      videoId: video.id,
      date: row.date,
      views: row.views ?? 0,
      watchTimeMinutes: row.watchTimeMinutes,
      averageViewDurationSeconds: row.averageViewDurationSeconds,
      averageViewPercentage: row.averageViewPercentage,
      subscribersGained: row.subscribersGained,
      subscribersLost: row.subscribersLost,
      likes: row.likes,
      comments: row.comments,
      // Only write reach for days a report actually described.
      impressions: covered ? (reachDay?.impressions ?? 0) : null,
      impressionsCtr: covered ? (reachDay?.impressionsCtr ?? null) : null,
    };
  });
}

function toSnapshotMetrics(totals: VideoAnalyticsTotals) {
  return {
    views: totals.views,
    watchTimeMinutes: totals.watchTimeMinutes,
    averageViewDurationSeconds: totals.averageViewDurationSeconds,
    averageViewPercentage: totals.averageViewPercentage,
    subscribersGained: totals.subscribersGained,
    subscribersLost: totals.subscribersLost,
    likes: totals.likes,
    comments: totals.comments,
  };
}

function addDaysString(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Sanitised message: upstream bodies and tokens never reach the client. */
function describeError(error: unknown, fallback: string): string {
  if (error instanceof YouTubeApiError) {
    return `${fallback} (${error.kind})`;
  }
  if (error instanceof Error && error.message.length < 160) {
    return error.message;
  }
  return fallback;
}
