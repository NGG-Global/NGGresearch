import 'server-only';
import { appMode, isDemoMode } from '@/lib/config/env';
import { buildDemoDataset } from '@/lib/demo/dataset';
import type { Insight } from '@/lib/domain/types';
import { emptyDataset, type ChannelDataset } from './dataset';

/**
 * The single read entry point for every page.
 *
 * Demo and live mode return the same shape, so components never learn which
 * mode they are rendering. Failures degrade to an empty dataset carrying an
 * error message rather than throwing into a blank page.
 */
export async function loadChannelDataset(now: Date = new Date()): Promise<ChannelDataset> {
  if (isDemoMode()) {
    const demo = buildDemoDataset(now);
    return {
      mode: 'demo',
      channel: demo.channel,
      videos: demo.videos,
      snapshots: demo.snapshots,
      daily: demo.daily,
      insights: new Map(),
      lastSyncRun: demo.lastSyncRun,
      loadError: null,
    };
  }

  try {
    // Imported lazily so demo mode never needs Supabase configuration present.
    const repositories = await import('@/lib/db/repositories');
    const channel = await repositories.getChannel();
    if (!channel) return { ...emptyDataset(), mode: 'live' };

    const videos = await repositories.listVideos(channel.id);
    const videoIds = videos.map((video) => video.id);
    const [snapshots, daily, lastSyncRun] = await Promise.all([
      repositories.listSnapshotsByVideo(videoIds),
      repositories.listDailyMetricsForVideos(videoIds),
      repositories.latestSyncRun(channel.id),
    ]);

    return {
      mode: 'live',
      channel,
      videos,
      snapshots,
      daily,
      insights: new Map<string, Insight>(),
      lastSyncRun,
      loadError: null,
    };
  } catch (error) {
    return {
      ...emptyDataset(
        error instanceof Error
          ? `טעינת הנתונים נכשלה: ${error.message}`
          : 'טעינת הנתונים נכשלה.',
      ),
      mode: appMode(),
    };
  }
}

export * from './dataset';
