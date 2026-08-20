import type { MetricValue } from './metric';

/* ------------------------------------------------------------------ channel */

export type TokenStatus = 'valid' | 'expired' | 'missing';

export interface Channel {
  readonly id: string;
  readonly youtubeChannelId: string;
  readonly title: string;
  readonly avatarUrl: string | null;
  readonly subscriberCount: number | null;
  readonly videoCount: number | null;
  readonly viewCount: number | null;
  readonly connectedAt: string;
  readonly lastSuccessfulSyncAt: string | null;
  readonly tokenStatus: TokenStatus;
}

/* -------------------------------------------------------------------- video */

export type ContentType = 'long_form' | 'short' | 'live' | 'unknown';

/**
 * How we decided the content type. YouTube does not expose a fully reliable
 * "is this a Short" flag on the Data API video resource, so the source and
 * confidence travel with the classification instead of being hidden.
 */
export type ClassificationSource =
  | 'manual_override'
  | 'youtube_shorts_probe'
  | 'live_broadcast_flag'
  | 'duration_heuristic'
  | 'unknown';

export type ClassificationConfidence = 'high' | 'medium' | 'low';

export interface ContentClassification {
  readonly contentType: ContentType;
  readonly source: ClassificationSource;
  readonly confidence: ClassificationConfidence;
  /** Only benchmark-eligible videos may enter a comparison set. */
  readonly benchmarkEligible: boolean;
}

export type PrivacyStatus = 'public' | 'unlisted' | 'private' | 'unknown';

export interface Video {
  readonly id: string;
  readonly channelId: string;
  readonly youtubeVideoId: string;
  readonly title: string;
  readonly description: string;
  readonly thumbnailUrl: string | null;
  readonly publishedAt: string;
  readonly durationSeconds: number | null;
  readonly privacyStatus: PrivacyStatus;
  readonly url: string;
  readonly classification: ContentClassification;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/* ----------------------------------------------------------------- snapshot */

/** Milestone identifiers. `h6`, `d14` and `d30` are wired but disabled in V1. */
export type SnapshotTarget = 'h6' | 'h24' | 'h72' | 'd7' | 'd14' | 'd30' | 'current';

/**
 * Provenance of a snapshot. This distinction is load-bearing:
 *
 *  - milestone_capture — measured while the video's real age was inside the
 *    tolerance window of the milestone. Comparable with other milestone captures.
 *  - daily_backfill    — reconstructed by summing YouTube's *daily* rows. Day
 *    granularity, so it is an approximation of the milestone, never an exact
 *    "24 hours after publication" reading.
 *  - current_state     — lifetime-to-date totals at capture time.
 */
export type SnapshotSource = 'milestone_capture' | 'daily_backfill' | 'current_state';

export interface SnapshotMetrics {
  readonly views: MetricValue;
  readonly watchTimeMinutes: MetricValue;
  readonly averageViewDurationSeconds: MetricValue;
  readonly averageViewPercentage: MetricValue;
  readonly subscribersGained: MetricValue;
  readonly subscribersLost: MetricValue;
  readonly likes: MetricValue;
  readonly comments: MetricValue;
  readonly impressions: MetricValue;
  readonly impressionsCtr: MetricValue;
}

export interface AnalyticsSnapshot {
  readonly id: string;
  readonly videoId: string;
  readonly capturedAt: string;
  /** Real age of the video at capture time, in hours. */
  readonly videoAgeHours: number;
  readonly snapshotTarget: SnapshotTarget;
  readonly snapshotSource: SnapshotSource;
  readonly metrics: SnapshotMetrics;
}

/** A single day of analytics for a video, used for charts and backfill. */
export interface DailyMetric {
  readonly videoId: string;
  readonly date: string;
  readonly views: number;
  readonly watchTimeMinutes: number | null;
  readonly averageViewDurationSeconds: number | null;
  readonly averageViewPercentage: number | null;
  readonly subscribersGained: number | null;
  readonly subscribersLost: number | null;
  readonly likes: number | null;
  readonly comments: number | null;
  readonly impressions: number | null;
  readonly impressionsCtr: number | null;
}

/* ------------------------------------------------------------------ insight */

export type InsightConfidence = 'high' | 'medium' | 'low';

export interface InsightPayload {
  readonly summary: string;
  readonly mainSignal: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly recommendation: string;
  readonly confidence: InsightConfidence;
}

export type InsightProvider = 'anthropic' | 'rules';

export interface Insight {
  readonly id: string;
  readonly videoId: string;
  readonly snapshotTarget: SnapshotTarget;
  readonly generatedAt: string;
  readonly provider: InsightProvider;
  readonly model: string | null;
  readonly payload: InsightPayload;
}

/* ----------------------------------------------------------------- sync run */

export type SyncTrigger = 'initial' | 'manual' | 'scheduled';
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed';

export interface SyncRun {
  readonly id: string;
  readonly channelId: string;
  readonly trigger: SyncTrigger;
  readonly status: SyncStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly videosProcessed: number;
  readonly snapshotsCreated: number;
  readonly warnings: readonly string[];
  readonly error: string | null;
}
