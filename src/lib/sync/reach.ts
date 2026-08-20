import { reachReportTypeId, reportingApiEnabled } from '@/lib/config/env';
import { getReportingJob, saveReportingJob } from '@/lib/db/repositories';
import {
  aggregateReachByVideo,
  downloadReachReport,
  ensureReachJob,
  fetchLatestReport,
  parseReachCsv,
  type ReachRow,
} from '@/lib/youtube/reporting-api';

/**
 * Reach data (thumbnail impressions + CTR) assembled from Reporting API reports.
 *
 * `coveredDates` is the crucial field: it records which calendar days the
 * downloaded reports actually describe. A video with no row on a covered date
 * genuinely had no impressions that day; a date that is *not* covered is simply
 * unknown, and any window touching it stays `pending` rather than being summed
 * into a misleadingly small number.
 */
export interface ReachDataset {
  readonly coveredDates: ReadonlySet<string>;
  readonly byVideo: ReadonlyMap<string, ReadonlyMap<string, ReachDay>>;
  readonly warnings: readonly string[];
  readonly available: boolean;
}

export interface ReachDay {
  readonly impressions: number | null;
  readonly impressionsCtr: number | null;
}

export const EMPTY_REACH: ReachDataset = {
  coveredDates: new Set<string>(),
  byVideo: new Map(),
  warnings: [],
  available: false,
};

/**
 * Fetches the latest reach report for the channel.
 *
 * Reporting API reports are per-day files, so a single report covers one day.
 * V1 downloads the most recent report; the sync service treats any window that
 * is not fully covered as pending.
 */
export async function loadReachDataset(params: {
  accessToken: string;
  channelId: string;
}): Promise<ReachDataset> {
  if (!reportingApiEnabled()) {
    return { ...EMPTY_REACH, warnings: ['דוחות החשיפות מושבתים בהגדרות הסביבה.'] };
  }

  const reportTypeId = reachReportTypeId();
  const stored = await getReportingJob(params.channelId, reportTypeId);

  const job = await ensureReachJob({
    accessToken: params.accessToken,
    reportTypeId,
    existingJobId: stored?.jobId ?? null,
  });
  if (job.jobId === null) {
    return { ...EMPTY_REACH, warnings: [`נתוני חשיפות אינם זמינים: ${job.reason}`] };
  }
  if (!stored) {
    await saveReportingJob({ channelId: params.channelId, reportTypeId, jobId: job.jobId });
  }

  const latest = await fetchLatestReport({ accessToken: params.accessToken, jobId: job.jobId });
  if (latest.status === 'pending') {
    return { ...EMPTY_REACH, warnings: [latest.reason] };
  }

  const report = await downloadReachReport({
    accessToken: params.accessToken,
    downloadUrl: latest.downloadUrl,
    reportId: latest.reportId,
  });

  if (report.status !== 'ready') {
    return { ...EMPTY_REACH, warnings: [report.reason] };
  }

  await saveReportingJob({
    channelId: params.channelId,
    reportTypeId,
    jobId: job.jobId,
    lastReportId: report.reportId,
  });

  return buildDataset(report.rows);
}

export function buildDataset(rows: readonly ReachRow[]): ReachDataset {
  const coveredDates = new Set<string>();
  const byVideo = new Map<string, Map<string, ReachDay>>();
  const undatedRows: ReachRow[] = [];

  for (const row of rows) {
    if (!row.date) {
      undatedRows.push(row);
      continue;
    }
    coveredDates.add(row.date);
    const perVideo = byVideo.get(row.videoId) ?? new Map<string, ReachDay>();
    perVideo.set(row.date, {
      impressions: row.impressions,
      impressionsCtr: row.impressionsCtr,
    });
    byVideo.set(row.videoId, perVideo);
  }

  const warnings: string[] = [];
  if (undatedRows.length > 0) {
    warnings.push(
      `${undatedRows.length} שורות בדוח החשיפות חסרות תאריך ולכן לא שויכו לנקודת מדידה.`,
    );
  }

  return { coveredDates, byVideo, warnings, available: coveredDates.size > 0 };
}

/**
 * Reach totals for a video over a date window, or null when the window is not
 * fully covered by downloaded reports.
 */
export function reachForWindow(
  dataset: ReachDataset,
  videoId: string,
  dates: readonly string[],
): ReachDay {
  if (!dataset.available || dates.length === 0) {
    return { impressions: null, impressionsCtr: null };
  }

  const fullyCovered = dates.every((date) => dataset.coveredDates.has(date));
  if (!fullyCovered) return { impressions: null, impressionsCtr: null };

  const perVideo = dataset.byVideo.get(videoId);
  if (!perVideo) {
    // Covered window with no rows for this video means zero impressions, which
    // is a real measurement rather than a missing one.
    return { impressions: 0, impressionsCtr: null };
  }

  const rows: ReachRow[] = dates.map((date) => {
    const day = perVideo.get(date);
    return {
      videoId,
      date,
      impressions: day?.impressions ?? 0,
      impressionsCtr: day?.impressionsCtr ?? null,
    };
  });

  const aggregated = aggregateReachByVideo(rows).get(videoId);
  return {
    impressions: aggregated?.impressions ?? 0,
    impressionsCtr: aggregated?.impressionsCtr ?? null,
  };
}

export { parseReachCsv };
