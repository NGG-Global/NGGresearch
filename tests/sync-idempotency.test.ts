import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase } from './fake-supabase';
import { makeVideo, NOW } from './fixtures';

const fake = new FakeSupabase();

vi.mock('@/lib/db/client', () => ({
  db: () => fake,
}));

const { upsertSnapshot, upsertVideos, upsertDailyMetrics } = await import(
  '@/lib/db/repositories'
);

const SNAPSHOT_TABLE = 'analytics_snapshots';

function snapshotInput(overrides: Partial<Parameters<typeof upsertSnapshot>[0]> = {}) {
  return {
    videoId: 'video-1',
    capturedAt: NOW,
    videoAgeHours: 25.5,
    snapshotTarget: 'h24' as const,
    snapshotSource: 'milestone_capture' as const,
    views: 620,
    watchTimeMinutes: 2_480,
    averageViewDurationSeconds: 240,
    averageViewPercentage: 44,
    subscribersGained: 31,
    subscribersLost: 4,
    likes: 410,
    comments: 38,
    impressions: 9_000,
    impressionsCtr: 6.9,
    ...overrides,
  };
}

describe('snapshot idempotency', () => {
  beforeEach(() => fake.reset());

  it('creates a snapshot on the first write', async () => {
    const result = await upsertSnapshot(snapshotInput());
    expect(result.created).toBe(true);
    expect(fake.countOf(SNAPSHOT_TABLE)).toBe(1);
  });

  it('does not duplicate a snapshot when the same sync runs again', async () => {
    await upsertSnapshot(snapshotInput());
    const second = await upsertSnapshot(snapshotInput());

    expect(second.created).toBe(false);
    expect(fake.countOf(SNAPSHOT_TABLE)).toBe(1);
  });

  it('refreshes the values in place on re-run instead of appending', async () => {
    await upsertSnapshot(snapshotInput({ views: 620 }));
    await upsertSnapshot(snapshotInput({ views: 705 }));

    expect(fake.countOf(SNAPSHOT_TABLE)).toBe(1);
    expect(fake.rowsOf(SNAPSHOT_TABLE)[0]!.views).toBe(705);
  });

  it('keeps a milestone capture and a daily backfill of the same target apart', async () => {
    await upsertSnapshot(snapshotInput({ snapshotSource: 'milestone_capture' }));
    await upsertSnapshot(snapshotInput({ snapshotSource: 'daily_backfill' }));

    // Provenance is part of the identity: the approximation must not overwrite
    // the real measurement.
    expect(fake.countOf(SNAPSHOT_TABLE)).toBe(2);
  });

  it('keeps different milestones of the same video apart', async () => {
    await upsertSnapshot(snapshotInput({ snapshotTarget: 'h24' }));
    await upsertSnapshot(snapshotInput({ snapshotTarget: 'h72' }));
    expect(fake.countOf(SNAPSHOT_TABLE)).toBe(2);
  });

  it('keeps different videos apart', async () => {
    await upsertSnapshot(snapshotInput({ videoId: 'video-1' }));
    await upsertSnapshot(snapshotInput({ videoId: 'video-2' }));
    expect(fake.countOf(SNAPSHOT_TABLE)).toBe(2);
  });

  it('records the real age at capture, not the nominal milestone', async () => {
    await upsertSnapshot(snapshotInput({ videoAgeHours: 27.25 }));
    expect(fake.rowsOf(SNAPSHOT_TABLE)[0]!.video_age_hours).toBe(27.25);
  });
});

describe('video upsert idempotency', () => {
  beforeEach(() => fake.reset());

  it('does not duplicate videos across repeated syncs', async () => {
    const videos = [
      makeVideo({ id: 'vid-1', publishedDaysAgo: 3 }),
      makeVideo({ id: 'vid-2', publishedDaysAgo: 10 }),
    ].map((video) => ({
      youtubeVideoId: video.youtubeVideoId,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      durationSeconds: video.durationSeconds,
      privacyStatus: video.privacyStatus,
      url: video.url,
      classification: video.classification,
    }));

    await upsertVideos('channel-1', videos);
    await upsertVideos('channel-1', videos);

    expect(fake.countOf('videos')).toBe(2);
  });

  it('updates changed metadata in place', async () => {
    const base = makeVideo({ id: 'vid-1', publishedDaysAgo: 3 });
    const input = {
      youtubeVideoId: base.youtubeVideoId,
      title: base.title,
      description: base.description,
      thumbnailUrl: base.thumbnailUrl,
      publishedAt: base.publishedAt,
      durationSeconds: base.durationSeconds,
      privacyStatus: base.privacyStatus,
      url: base.url,
      classification: base.classification,
    };

    await upsertVideos('channel-1', [input]);
    await upsertVideos('channel-1', [{ ...input, title: 'כותרת מעודכנת' }]);

    expect(fake.countOf('videos')).toBe(1);
    expect(fake.rowsOf('videos')[0]!.title).toBe('כותרת מעודכנת');
  });

  it('writes nothing for an empty batch', async () => {
    await upsertVideos('channel-1', []);
    expect(fake.countOf('videos')).toBe(0);
  });
});

describe('daily metric idempotency', () => {
  beforeEach(() => fake.reset());

  it('keys daily rows by video and date', async () => {
    const row = {
      videoId: 'vid-1',
      date: '2026-08-18',
      views: 100,
      watchTimeMinutes: 400,
      averageViewDurationSeconds: 240,
      averageViewPercentage: 44,
      subscribersGained: 3,
      subscribersLost: 0,
      likes: 20,
      comments: 4,
      impressions: 900,
      impressionsCtr: 6.9,
    };

    await upsertDailyMetrics([row]);
    await upsertDailyMetrics([{ ...row, views: 140 }]);
    await upsertDailyMetrics([{ ...row, date: '2026-08-19' }]);

    expect(fake.countOf('daily_metrics')).toBe(2);
    const updated = fake.rowsOf('daily_metrics').find((r) => r.date === '2026-08-18');
    expect(updated?.views).toBe(140);
  });
});
