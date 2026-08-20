import { median } from '@/lib/benchmark/statistics';
import type { ChannelDataset } from '@/lib/data/dataset';
import { dailyFor } from '@/lib/data/dataset';
import type { DailyMetric, Video } from '@/lib/domain/types';

/**
 * Performance over time: cumulative views by day of life, for this video and
 * for the median of comparable videos at the same point in *their* lifecycle.
 *
 * Aligning by day-of-life rather than calendar date is what makes the
 * comparison meaningful — day 3 of one upload against day 3 of the others.
 */
export interface PerformancePoint {
  readonly dayIndex: number;
  readonly subjectViews: number | null;
  readonly benchmarkViews: number | null;
}

export interface PerformanceSeries {
  readonly points: readonly PerformancePoint[];
  readonly peerCount: number;
  readonly hasSubjectData: boolean;
  readonly hasBenchmark: boolean;
}

export const EMPTY_SERIES: PerformanceSeries = {
  points: [],
  peerCount: 0,
  hasSubjectData: false,
  hasBenchmark: false,
};

export function buildPerformanceSeries(params: {
  dataset: ChannelDataset;
  subject: Video;
  maxDays?: number;
}): PerformanceSeries {
  const maxDays = params.maxDays ?? 14;
  const subjectCurve = cumulativeCurve(dailyFor(params.dataset, params.subject.id), maxDays);

  const peerCurves: number[][] = [];
  for (const video of params.dataset.videos) {
    if (video.id === params.subject.id) continue;
    if (!video.classification.benchmarkEligible) continue;
    if (video.classification.contentType !== params.subject.classification.contentType) continue;
    if (new Date(video.publishedAt).getTime() >= new Date(params.subject.publishedAt).getTime()) {
      continue;
    }
    const curve = cumulativeCurve(dailyFor(params.dataset, video.id), maxDays);
    if (curve.length > 0) peerCurves.push(curve);
  }

  const length = Math.max(
    subjectCurve.length,
    peerCurves.reduce((longest, curve) => Math.max(longest, curve.length), 0),
  );

  const points: PerformancePoint[] = [];
  for (let day = 0; day < Math.min(length, maxDays); day += 1) {
    const peerValues = peerCurves
      .map((curve) => curve[day])
      .filter((value): value is number => value !== undefined);

    points.push({
      dayIndex: day,
      subjectViews: subjectCurve[day] ?? null,
      // Only draw the benchmark line where enough peers actually reached this day.
      benchmarkViews: peerValues.length >= 3 ? median(peerValues) : null,
    });
  }

  return {
    points,
    peerCount: peerCurves.length,
    hasSubjectData: subjectCurve.length > 0,
    hasBenchmark: points.some((point) => point.benchmarkViews !== null),
  };
}

function cumulativeCurve(rows: readonly DailyMetric[], maxDays: number): number[] {
  if (rows.length === 0) return [];
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const curve: number[] = [];
  let running = 0;
  for (const row of ordered.slice(0, maxDays)) {
    running += row.views;
    curve.push(running);
  }
  return curve;
}
