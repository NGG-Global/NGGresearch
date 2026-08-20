import { gunzipSync } from 'node:zlib';
import { YouTubeApiError, kindFromStatus } from './errors';
import { googleFetch } from './http';

const BASE = 'https://youtubereporting.googleapis.com/v1';
const API = 'youtube.reporting';

/**
 * Thumbnail impressions and impressions CTR are not available from the
 * YouTube Analytics API — only from Reporting API bulk reach reports (for
 * example `channel_reach_basic_a1`).
 *
 * Reporting API data is inherently late: a job must exist before YouTube starts
 * generating reports, and the first report can take a day or more to appear.
 * Every function here therefore reports a *state* rather than throwing, so the
 * rest of the application keeps working with reach metrics marked `pending`.
 */

export interface ReachRow {
  videoId: string;
  date: string | null;
  impressions: number | null;
  /** Stored as a percentage (6.8 = 6.8%). */
  impressionsCtr: number | null;
}

export type ReachOutcome =
  | { status: 'ready'; rows: ReachRow[]; reportId: string; columns: string[] }
  | { status: 'pending'; reason: string }
  | { status: 'unavailable'; reason: string };

interface JobsResponse {
  jobs?: Array<{ id?: string; reportTypeId?: string; name?: string }>;
}

interface ReportsResponse {
  reports?: Array<{
    id?: string;
    jobId?: string;
    startTime?: string;
    endTime?: string;
    createTime?: string;
    downloadUrl?: string;
  }>;
}

/**
 * Finds or creates the reporting job for a report type.
 * Returns null (with a reason) when the report type is not available to this
 * channel — a normal situation that must not break a sync.
 */
export async function ensureReachJob(params: {
  accessToken: string;
  reportTypeId: string;
  existingJobId?: string | null;
}): Promise<{ jobId: string } | { jobId: null; reason: string }> {
  if (params.existingJobId) return { jobId: params.existingJobId };

  try {
    const existing = await googleFetch<JobsResponse>({
      url: `${BASE}/jobs`,
      accessToken: params.accessToken,
      api: API,
    });
    const match = existing.jobs?.find((job) => job.reportTypeId === params.reportTypeId);
    if (match?.id) return { jobId: match.id };

    const created = await googleFetch<{ id?: string }>({
      url: `${BASE}/jobs`,
      accessToken: params.accessToken,
      api: API,
      method: 'POST',
      body: { reportTypeId: params.reportTypeId, name: `layla-lavan-${params.reportTypeId}` },
    });
    if (created.id) return { jobId: created.id };
    return { jobId: null, reason: 'YouTube did not return a reporting job id.' };
  } catch (error) {
    const message =
      error instanceof YouTubeApiError ? error.message : 'Reporting API job setup failed.';
    return { jobId: null, reason: message };
  }
}

/** Most recent generated report for a job, if any exists yet. */
export async function fetchLatestReport(params: {
  accessToken: string;
  jobId: string;
}): Promise<
  | { status: 'ready'; reportId: string; downloadUrl: string; endTime: string | null }
  | { status: 'pending'; reason: string }
> {
  try {
    const body = await googleFetch<ReportsResponse>({
      url: `${BASE}/jobs/${encodeURIComponent(params.jobId)}/reports`,
      accessToken: params.accessToken,
      api: API,
    });
    const reports = (body.reports ?? []).filter((report) => report.downloadUrl && report.id);
    if (reports.length === 0) {
      return {
        status: 'pending',
        reason: 'דוח החשיפות עדיין לא נוצר על ידי YouTube.',
      };
    }
    const latest = [...reports].sort(
      (a, b) => Date.parse(b.endTime ?? b.createTime ?? '') - Date.parse(a.endTime ?? a.createTime ?? ''),
    )[0]!;
    return {
      status: 'ready',
      reportId: latest.id!,
      downloadUrl: latest.downloadUrl!,
      endTime: latest.endTime ?? null,
    };
  } catch (error) {
    return {
      status: 'pending',
      reason: error instanceof YouTubeApiError ? error.message : 'Reporting API list failed.',
    };
  }
}

/**
 * Downloads and parses a reach report.
 *
 * Column names differ between report versions, so the parser resolves columns
 * by name from a candidate list. If it cannot find an impressions column it
 * returns `unavailable` with the header row in the reason — the metrics stay
 * unknown rather than being guessed.
 */
export async function downloadReachReport(params: {
  accessToken: string;
  downloadUrl: string;
  reportId: string;
}): Promise<ReachOutcome> {
  let csv: string;
  try {
    csv = await downloadText(params.downloadUrl, params.accessToken);
  } catch (error) {
    return {
      status: 'pending',
      reason: error instanceof YouTubeApiError ? error.message : 'Report download failed.',
    };
  }

  return parseReachCsv(csv, params.reportId);
}

const VIDEO_ID_COLUMNS = ['video_id'];
const DATE_COLUMNS = ['date'];
const IMPRESSION_COLUMNS = ['impressions', 'thumbnail_impressions'];
const CTR_COLUMNS = [
  'impressions_ctr',
  'thumbnail_impressions_ctr',
  'impressions_click_through_rate',
];

export function parseReachCsv(csv: string, reportId: string): ReachOutcome {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0];
  if (!headerLine) {
    return { status: 'pending', reason: 'דוח החשיפות ריק.' };
  }

  const columns = headerLine.split(',').map((name) => name.trim().toLowerCase());
  const videoIndex = findColumn(columns, VIDEO_ID_COLUMNS);
  const impressionsIndex = findColumn(columns, IMPRESSION_COLUMNS);
  const ctrIndex = findColumn(columns, CTR_COLUMNS);
  const dateIndex = findColumn(columns, DATE_COLUMNS);

  if (videoIndex < 0 || impressionsIndex < 0) {
    return {
      status: 'unavailable',
      reason: `לא נמצאו עמודות חשיפות בדוח. עמודות שהתקבלו: ${columns.join(', ')}`,
    };
  }

  const rows: ReachRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const videoId = cells[videoIndex]?.trim();
    if (!videoId) continue;
    rows.push({
      videoId,
      date: dateIndex >= 0 ? normaliseDate(cells[dateIndex]) : null,
      impressions: toNumber(cells[impressionsIndex]),
      impressionsCtr: ctrIndex >= 0 ? normaliseCtr(toNumber(cells[ctrIndex])) : null,
    });
  }

  if (rows.length === 0) {
    return { status: 'pending', reason: 'דוח החשיפות לא כולל שורות נתונים.' };
  }

  return { status: 'ready', rows, reportId, columns };
}

/**
 * Aggregates report rows per video.
 * CTR is re-derived as a click-weighted average, because averaging daily CTRs
 * unweighted would over-count low-impression days.
 */
export function aggregateReachByVideo(
  rows: readonly ReachRow[],
): Map<string, { impressions: number | null; impressionsCtr: number | null }> {
  const totals = new Map<string, { impressions: number; weightedCtr: number; hasCtr: boolean }>();

  for (const row of rows) {
    const impressions = row.impressions ?? 0;
    const bucket = totals.get(row.videoId) ?? { impressions: 0, weightedCtr: 0, hasCtr: false };
    bucket.impressions += impressions;
    if (row.impressionsCtr !== null && impressions > 0) {
      bucket.weightedCtr += row.impressionsCtr * impressions;
      bucket.hasCtr = true;
    }
    totals.set(row.videoId, bucket);
  }

  const result = new Map<string, { impressions: number | null; impressionsCtr: number | null }>();
  for (const [videoId, bucket] of totals) {
    result.set(videoId, {
      impressions: bucket.impressions > 0 ? bucket.impressions : null,
      impressionsCtr:
        bucket.hasCtr && bucket.impressions > 0 ? bucket.weightedCtr / bucket.impressions : null,
    });
  }
  return result;
}

async function downloadText(url: string, accessToken: string): Promise<string> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new YouTubeApiError({
      message: `Report download returned ${response.status}`,
      kind: kindFromStatus(response.status),
      status: response.status,
      api: API,
    });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  // Reports are gzipped. `fetch` transparently decompresses when the response
  // carries Content-Encoding: gzip, but not when the body is a gzip *file*.
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return gunzipSync(buffer).toString('utf8');
  }
  return buffer.toString('utf8');
}

function findColumn(columns: readonly string[], candidates: readonly string[]): number {
  for (const candidate of candidates) {
    const index = columns.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reach reports express CTR as a ratio (0.068). Values at or below 1 are
 * therefore scaled to percent; values above 1 are assumed to already be
 * percentages. Documented in the README as an assumption about report format.
 */
function normaliseCtr(value: number | null): number | null {
  if (value === null) return null;
  return value <= 1 ? value * 100 : value;
}

/** Report dates arrive as YYYYMMDD. */
function normaliseDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}
