import { describe, expect, it } from 'vitest';
import {
  availableTargets,
  defaultTarget,
  dueMilestones,
  enabledMilestones,
  milestoneUnavailableReason,
  missedMilestones,
  selectSnapshot,
  videoAgeHours,
} from '@/lib/domain/snapshots';
import { makeSnapshot, NOW } from './fixtures';

describe('videoAgeHours', () => {
  it('measures age in hours from publication', () => {
    const published = new Date(NOW.getTime() - 30 * 3_600_000).toISOString();
    expect(videoAgeHours(published, NOW)).toBeCloseTo(30, 5);
  });

  it('never returns a negative age for a future timestamp', () => {
    const future = new Date(NOW.getTime() + 3_600_000).toISOString();
    expect(videoAgeHours(future, NOW)).toBe(0);
  });
});

describe('milestone configuration', () => {
  it('enables exactly the V1 milestones', () => {
    expect(enabledMilestones().map((m) => m.target)).toEqual(['h24', 'h72', 'd7']);
  });
});

describe('dueMilestones', () => {
  it('opens the 24h window inside its tolerance', () => {
    expect(dueMilestones(26, []).map((m) => m.target)).toContain('h24');
  });

  it('does not open a window before the video reaches that age', () => {
    expect(dueMilestones(20, []).map((m) => m.target)).not.toContain('h24');
  });

  it('closes the window once tolerance has passed', () => {
    // 24h milestone tolerates 6 further hours; 31h is too late.
    expect(dueMilestones(31, []).map((m) => m.target)).not.toContain('h24');
  });

  it('skips a milestone that already has a real capture', () => {
    const existing = [makeSnapshot({ videoId: 'v1', target: 'h24' })];
    expect(dueMilestones(26, existing).map((m) => m.target)).not.toContain('h24');
  });

  it('still captures when only a backfill approximation exists', () => {
    const existing = [
      makeSnapshot({ videoId: 'v1', target: 'h24', source: 'daily_backfill' }),
    ];
    // A real measurement is strictly better than the approximation.
    expect(dueMilestones(26, existing).map((m) => m.target)).toContain('h24');
  });
});

describe('missedMilestones', () => {
  it('reports every window that closed with nothing captured', () => {
    // At 400h (about 17 days) all three V1 windows have closed.
    expect(missedMilestones(400, []).map((m) => m.target)).toEqual(['h24', 'h72', 'd7']);
  });

  it('reports only the closed windows for a younger video', () => {
    // At 100h the 24h and 72h windows are past; 7d has not been reached.
    expect(missedMilestones(100, []).map((m) => m.target)).toEqual(['h24', 'h72']);
  });

  it('does not report a milestone that has any snapshot', () => {
    const existing = [
      makeSnapshot({ videoId: 'v1', target: 'h24', source: 'daily_backfill' }),
    ];
    expect(missedMilestones(400, existing).map((m) => m.target)).toEqual(['h72', 'd7']);
  });
});

describe('selectSnapshot', () => {
  it('prefers a real milestone capture over a daily backfill', () => {
    const snapshots = [
      makeSnapshot({ videoId: 'v1', target: 'h24', source: 'daily_backfill' }),
      makeSnapshot({ videoId: 'v1', target: 'h24', source: 'milestone_capture' }),
    ];
    expect(selectSnapshot(snapshots, 'h24')?.snapshotSource).toBe('milestone_capture');
  });

  it('prefers the most recent capture among equals', () => {
    const older = makeSnapshot({
      videoId: 'v1',
      target: 'current',
      source: 'current_state',
      capturedAt: '2026-08-01T00:00:00.000Z',
    });
    const newer = makeSnapshot({
      videoId: 'v1',
      target: 'current',
      source: 'current_state',
      capturedAt: '2026-08-19T00:00:00.000Z',
    });
    expect(selectSnapshot([older, newer], 'current')?.capturedAt).toBe(newer.capturedAt);
  });

  it('returns null when the target has no data', () => {
    expect(selectSnapshot([], 'd7')).toBeNull();
  });
});

describe('target selection', () => {
  it('lists available targets in milestone order with current last', () => {
    const snapshots = [
      makeSnapshot({ videoId: 'v1', target: 'current', source: 'current_state' }),
      makeSnapshot({ videoId: 'v1', target: 'h72' }),
      makeSnapshot({ videoId: 'v1', target: 'h24' }),
    ];
    expect(availableTargets(snapshots)).toEqual(['h24', 'h72', 'current']);
  });

  it('defaults to the most mature milestone present', () => {
    const snapshots = [
      makeSnapshot({ videoId: 'v1', target: 'h24' }),
      makeSnapshot({ videoId: 'v1', target: 'h72' }),
      makeSnapshot({ videoId: 'v1', target: 'current', source: 'current_state' }),
    ];
    expect(defaultTarget(snapshots)).toBe('h72');
  });

  it('falls back to current when no milestone exists', () => {
    const snapshots = [
      makeSnapshot({ videoId: 'v1', target: 'current', source: 'current_state' }),
    ];
    expect(defaultTarget(snapshots)).toBe('current');
  });

  it('returns null with no snapshots at all', () => {
    expect(defaultTarget([])).toBeNull();
  });
});

describe('milestoneUnavailableReason', () => {
  it('explains a video that is simply too young', () => {
    expect(milestoneUnavailableReason('d7', 72)).toBe('too_young');
  });

  it('explains a window that is still open', () => {
    expect(milestoneUnavailableReason('h24', 26)).toBe('window_open');
  });

  it('explains a permanently missed measurement', () => {
    expect(milestoneUnavailableReason('h24', 500)).toBe('never_captured');
  });
});
