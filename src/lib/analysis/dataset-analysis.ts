import type { BenchmarkCandidate } from '@/lib/benchmark';
import type { ChannelDataset } from '@/lib/data/dataset';
import { snapshotsFor } from '@/lib/data/dataset';
import type { SnapshotTarget, Video } from '@/lib/domain/types';
import { attentionSignals, type AttentionSignal } from './attention';
import { analyseVideo, type VideoAnalysis } from './video-analysis';

/** Videos shown in the dashboard's "recent videos" card. */
export const RECENT_VIDEO_COUNT = 6;

export function buildCandidates(dataset: ChannelDataset): BenchmarkCandidate[] {
  return dataset.videos.map((video) => ({
    video,
    snapshots: snapshotsFor(dataset, video.id),
  }));
}

export function analyseOne(
  dataset: ChannelDataset,
  video: Video,
  target?: SnapshotTarget | null,
  now: Date = new Date(),
): VideoAnalysis {
  return analyseVideo({
    video,
    snapshots: snapshotsFor(dataset, video.id),
    candidates: buildCandidates(dataset),
    target: target ?? null,
    now,
  });
}

/** Analyses every video once, each at its own most mature available milestone. */
export function analyseAll(dataset: ChannelDataset, now: Date = new Date()): VideoAnalysis[] {
  const candidates = buildCandidates(dataset);
  return dataset.videos.map((video) =>
    analyseVideo({
      video,
      snapshots: snapshotsFor(dataset, video.id),
      candidates,
      now,
    }),
  );
}

export interface DashboardView {
  readonly latest: VideoAnalysis | null;
  readonly recent: readonly VideoAnalysis[];
  readonly attention: readonly AttentionSignal[];
  readonly allAnalyses: readonly VideoAnalysis[];
}

/**
 * The dashboard is about the newest *benchmarkable* upload: a Short or a live
 * stream at the top of the list would otherwise hide the video the channel
 * actually wants to read.
 */
export function buildDashboardView(
  dataset: ChannelDataset,
  now: Date = new Date(),
): DashboardView {
  const analyses = analyseAll(dataset, now);
  const latest =
    analyses.find((analysis) => analysis.video.classification.benchmarkEligible) ??
    analyses[0] ??
    null;

  const recent = analyses.slice(0, RECENT_VIDEO_COUNT);
  const attention = attentionSignals({
    analyses: latest ? [latest, ...recent.filter((a) => a !== latest)] : recent,
    channel: dataset.channel,
    lastSyncRun: dataset.lastSyncRun,
  });

  return { latest, recent, attention, allAnalyses: analyses };
}
