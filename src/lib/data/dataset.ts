import { appMode, type AppMode } from '@/lib/config/env';
import type {
  AnalyticsSnapshot,
  Channel,
  DailyMetric,
  Insight,
  SnapshotTarget,
  SyncRun,
  Video,
} from '@/lib/domain/types';

/**
 * Everything a page needs, in one shape.
 *
 * A single-channel dashboard with a few dozen videos is small enough to load
 * whole, which keeps the read path trivial and means demo and live mode differ
 * only in how this object is produced.
 */
export interface ChannelDataset {
  readonly mode: AppMode;
  readonly channel: Channel | null;
  readonly videos: readonly Video[];
  readonly snapshots: ReadonlyMap<string, readonly AnalyticsSnapshot[]>;
  readonly daily: ReadonlyMap<string, readonly DailyMetric[]>;
  readonly insights: ReadonlyMap<string, Insight>;
  readonly lastSyncRun: SyncRun | null;
  /** Set when the data layer itself failed, so pages can render an error state. */
  readonly loadError: string | null;
}

export function insightKey(videoId: string, target: SnapshotTarget): string {
  return `${videoId}:${target}`;
}

export function emptyDataset(loadError: string | null = null): ChannelDataset {
  return {
    mode: appMode(),
    channel: null,
    videos: [],
    snapshots: new Map(),
    daily: new Map(),
    insights: new Map(),
    lastSyncRun: null,
    loadError,
  };
}

export function snapshotsFor(
  dataset: ChannelDataset,
  videoId: string,
): readonly AnalyticsSnapshot[] {
  return dataset.snapshots.get(videoId) ?? [];
}

export function dailyFor(dataset: ChannelDataset, videoId: string): readonly DailyMetric[] {
  return dataset.daily.get(videoId) ?? [];
}
