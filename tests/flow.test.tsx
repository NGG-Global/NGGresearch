import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { analyseOne, buildDashboardView } from '@/lib/analysis/dataset-analysis';
import { buildPerformanceSeries } from '@/lib/analysis/chart';
import { buildDemoDataset } from '@/lib/demo/dataset';
import type { ChannelDataset } from '@/lib/data/dataset';
import { buildInsightFacts, generateRulesInsight } from '@/lib/insights/engine';
import { validateInsightPayload } from '@/lib/insights/schema';
import { SnapshotSelector } from '@/components/video/SnapshotSelector';
import { NOW } from './fixtures';

// The selector is a client component that reads router state; stub the hooks so
// it can be rendered in isolation.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/videos/demo-scp-049',
  useSearchParams: () => new URLSearchParams('snapshot=h72'),
}));

/**
 * The critical flow — connect (demo dataset stands in for a completed sync),
 * dashboard, video, snapshot switch — exercised at the data layer that the
 * pages render from, plus the interactive selector itself.
 */
function demoDataset(): ChannelDataset {
  const demo = buildDemoDataset(NOW);
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

describe('connect → sync → dashboard', () => {
  const dataset = demoDataset();

  it('produces a channel and videos without any credentials', () => {
    expect(dataset.channel?.title).toBe('לילה לבן');
    expect(dataset.videos.length).toBeGreaterThan(5);
    expect(dataset.lastSyncRun?.status).toBe('success');
  });

  it('picks a benchmarkable latest video for the dashboard hero', () => {
    const view = buildDashboardView(dataset, NOW);
    expect(view.latest).not.toBeNull();
    expect(view.latest!.video.classification.benchmarkEligible).toBe(true);
    // The newest upload overall is a Short; it must not become the hero.
    expect(view.latest!.video.classification.contentType).toBe('long_form');
  });

  it('defaults the hero to a real milestone rather than lifetime totals', () => {
    const view = buildDashboardView(dataset, NOW);
    expect(view.latest!.target).toBe('h72');
    expect(view.latest!.snapshot?.snapshotSource).toBe('milestone_capture');
  });

  it('benchmarks the hero against comparable videos only', () => {
    const view = buildDashboardView(dataset, NOW);
    const peers = view.latest!.comparison.peers;
    expect(peers.length).toBeGreaterThanOrEqual(5);
    for (const peer of peers) {
      expect(peer.video.classification.contentType).toBe('long_form');
      expect(peer.video.classification.benchmarkEligible).toBe(true);
    }
  });

  it('lists recent videos and only genuine attention signals', () => {
    const view = buildDashboardView(dataset, NOW);
    expect(view.recent.length).toBeGreaterThan(0);
    for (const signal of view.attention) {
      expect(signal.titleHe.length).toBeGreaterThan(0);
      expect(signal.detailHe.length).toBeGreaterThan(0);
    }
  });

  it('generates a schema-valid, grounded insight for the hero', () => {
    const view = buildDashboardView(dataset, NOW);
    const insight = generateRulesInsight(buildInsightFacts(view.latest!, 'לילה לבן'));
    expect(validateInsightPayload(insight).ok).toBe(true);
    expect(insight.summary.length).toBeGreaterThan(10);
  });
});

describe('dashboard → video → snapshot', () => {
  const dataset = demoDataset();
  const subject = dataset.videos.find((video) => video.id === 'demo-scp-049')!;

  it('opens the video detail analysis', () => {
    const analysis = analyseOne(dataset, subject, null, NOW);
    expect(analysis.video.title).toContain('SCP-049');
    expect(analysis.snapshot).not.toBeNull();
    expect(analysis.score.score).not.toBeNull();
  });

  it('offers the milestones the video has actually reached', () => {
    const analysis = analyseOne(dataset, subject, null, NOW);
    // Three days old: 24h and 72h exist, 7d does not.
    expect(analysis.availableTargets).toContain('h24');
    expect(analysis.availableTargets).toContain('h72');
    expect(analysis.availableTargets).not.toContain('d7');
  });

  it('switches snapshot and returns different measured values', () => {
    const at72 = analyseOne(dataset, subject, 'h72', NOW);
    const at24 = analyseOne(dataset, subject, 'h24', NOW);

    expect(at72.target).toBe('h72');
    expect(at24.target).toBe('h24');
    expect(at24.snapshot!.metrics.views.value).toBeLessThan(at72.snapshot!.metrics.views.value!);
  });

  it('re-benchmarks against peers at the newly selected milestone', () => {
    const at24 = analyseOne(dataset, subject, 'h24', NOW);
    for (const peer of at24.comparison.peers) {
      expect(peer.snapshot.snapshotTarget).toBe('h24');
    }
  });

  it('ignores an unavailable milestone and falls back to a real one', () => {
    const analysis = analyseOne(dataset, subject, 'd7', NOW);
    expect(analysis.target).not.toBe('d7');
    expect(analysis.availableTargets).toContain(analysis.target!);
  });

  it('builds a performance series with a benchmark line', () => {
    const series = buildPerformanceSeries({ dataset, subject });
    expect(series.hasSubjectData).toBe(true);
    expect(series.hasBenchmark).toBe(true);
    expect(series.peerCount).toBeGreaterThanOrEqual(3);
  });

  it('keeps a backfilled video honest about its provenance', () => {
    const backfilled = dataset.videos.find((video) => video.id === 'demo-vanished-village')!;
    const analysis = analyseOne(dataset, backfilled, 'h72', NOW);
    expect(analysis.snapshot?.snapshotSource).toBe('daily_backfill');
    expect(analysis.dataQualityNotes.join(' ')).toContain('קירוב');
  });

  it('does not benchmark a Short against long-form videos', () => {
    const short = dataset.videos.find((video) => video.id === 'demo-short-teaser')!;
    const analysis = analyseOne(dataset, short, null, NOW);
    expect(analysis.comparison.subjectEligible).toBe(false);
    expect(analysis.comparison.hasEnoughData).toBe(false);
    expect(analysis.score.status).toBe('insufficient_data');
  });

  it('marks reach metrics pending where reports do not reach back', () => {
    const older = dataset.videos.find((video) => video.id === 'demo-kyiv-metro')!;
    const analysis = analyseOne(dataset, older, null, NOW);
    expect(analysis.snapshot?.metrics.impressionsCtr.state).toBe('pending');
    expect(analysis.snapshot?.metrics.impressionsCtr.value).toBeNull();
  });
});

describe('SnapshotSelector', () => {
  it('renders available milestones and disables the rest with a reason', () => {
    render(
      <SnapshotSelector
        options={[
          { target: 'h24', label: '24 שעות', available: true, reason: null },
          { target: 'h72', label: '72 שעות', available: true, reason: null },
          { target: 'd7', label: '7 ימים', available: false, reason: 'הסרטון עדיין לא הגיע לגיל הזה' },
        ]}
        active="h72"
      />,
    );

    const active = screen.getByRole('button', { name: '72 שעות' });
    expect(active.getAttribute('aria-pressed')).toBe('true');

    const disabled = screen.getByRole('button', { name: '7 ימים' });
    expect(disabled).toBeDefined();
    // Unavailable milestones stay visible and explain themselves.
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    expect(disabled.getAttribute('title')).toBe('הסרטון עדיין לא הגיע לגיל הזה');
  });
});
