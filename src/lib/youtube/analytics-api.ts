import { googleFetch } from './http';

const BASE = 'https://youtubeanalytics.googleapis.com/v2/reports';
const API = 'youtube.analytics';

/**
 * Metrics requested for every video. All are available to the channel owner
 * under the yt-analytics.readonly scope.
 *
 * Note what is *not* here: impressions and impressions CTR. Those are not
 * exposed by the Analytics API at all — they come from the Reporting API reach
 * reports (see reporting-api.ts).
 */
export const VIDEO_METRICS = [
  'views',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'subscribersGained',
  'subscribersLost',
  'likes',
  'comments',
] as const;

export interface VideoAnalyticsTotals {
  views: number | null;
  watchTimeMinutes: number | null;
  averageViewDurationSeconds: number | null;
  averageViewPercentage: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
  likes: number | null;
  comments: number | null;
}

export interface VideoAnalyticsDay extends VideoAnalyticsTotals {
  date: string;
}

interface ReportResponse {
  columnHeaders?: Array<{ name?: string }>;
  rows?: Array<Array<string | number>>;
}

/**
 * Cumulative totals for one video over a date range.
 *
 * Ranges are whole UTC days — the Analytics API has no finer granularity. That
 * is why a real "24 hours after publication" reading has to be taken by
 * querying lifetime totals *while the video is actually about 24 hours old*,
 * rather than by asking for the first day and calling it a 24h snapshot.
 */
export async function fetchVideoTotals(params: {
  accessToken: string;
  videoId: string;
  startDate: string;
  endDate: string;
}): Promise<VideoAnalyticsTotals | null> {
  const query = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: params.startDate,
    endDate: params.endDate,
    metrics: VIDEO_METRICS.join(','),
    filters: `video==${params.videoId}`,
  });

  const body = await googleFetch<ReportResponse>({
    url: `${BASE}?${query.toString()}`,
    accessToken: params.accessToken,
    api: API,
  });

  const row = body.rows?.[0];
  if (!row) return null;
  return readTotals(body.columnHeaders ?? [], row);
}

/** Per-day rows for one video, used for charts and for honest backfill. */
export async function fetchVideoDaily(params: {
  accessToken: string;
  videoId: string;
  startDate: string;
  endDate: string;
}): Promise<VideoAnalyticsDay[]> {
  const query = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: params.startDate,
    endDate: params.endDate,
    metrics: VIDEO_METRICS.join(','),
    dimensions: 'day',
    filters: `video==${params.videoId}`,
    sort: 'day',
  });

  const body = await googleFetch<ReportResponse>({
    url: `${BASE}?${query.toString()}`,
    accessToken: params.accessToken,
    api: API,
  });

  const headers = body.columnHeaders ?? [];
  const dayIndex = headers.findIndex((header) => header.name === 'day');

  return (body.rows ?? []).flatMap((row) => {
    const date = dayIndex >= 0 ? String(row[dayIndex]) : null;
    if (!date) return [];
    return [{ date, ...readTotals(headers, row) }];
  });
}

function readTotals(
  headers: ReadonlyArray<{ name?: string }>,
  row: ReadonlyArray<string | number>,
): VideoAnalyticsTotals {
  const read = (metric: string): number | null => {
    const index = headers.findIndex((header) => header.name === metric);
    if (index < 0) return null;
    const value = row[index];
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    views: read('views'),
    watchTimeMinutes: read('estimatedMinutesWatched'),
    averageViewDurationSeconds: read('averageViewDuration'),
    averageViewPercentage: read('averageViewPercentage'),
    subscribersGained: read('subscribersGained'),
    subscribersLost: read('subscribersLost'),
    likes: read('likes'),
    comments: read('comments'),
  };
}

/** Sums a set of daily rows into totals, preserving unknown values as null. */
export function sumDailyRows(rows: readonly VideoAnalyticsDay[]): VideoAnalyticsTotals {
  if (rows.length === 0) {
    return {
      views: null,
      watchTimeMinutes: null,
      averageViewDurationSeconds: null,
      averageViewPercentage: null,
      subscribersGained: null,
      subscribersLost: null,
      likes: null,
      comments: null,
    };
  }

  const sum = (pick: (row: VideoAnalyticsDay) => number | null): number | null => {
    const values = rows.map(pick).filter((v): v is number => v !== null);
    return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
  };

  const views = sum((row) => row.views);
  const watchTimeMinutes = sum((row) => row.watchTimeMinutes);

  // Averages cannot be summed. Weight them by that day's views so the result is
  // the real average over the period rather than an average of averages.
  const weighted = (pick: (row: VideoAnalyticsDay) => number | null): number | null => {
    let weightSum = 0;
    let valueSum = 0;
    for (const row of rows) {
      const value = pick(row);
      const weight = row.views ?? 0;
      if (value === null || weight <= 0) continue;
      valueSum += value * weight;
      weightSum += weight;
    }
    return weightSum > 0 ? valueSum / weightSum : null;
  };

  return {
    views,
    watchTimeMinutes,
    averageViewDurationSeconds: weighted((row) => row.averageViewDurationSeconds),
    averageViewPercentage: weighted((row) => row.averageViewPercentage),
    subscribersGained: sum((row) => row.subscribersGained),
    subscribersLost: sum((row) => row.subscribersLost),
    likes: sum((row) => row.likes),
    comments: sum((row) => row.comments),
  };
}
