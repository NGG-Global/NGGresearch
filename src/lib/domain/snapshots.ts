import type { AnalyticsSnapshot, SnapshotSource, SnapshotTarget } from './types';

export interface MilestoneConfig {
  readonly target: SnapshotTarget;
  /** Video age the milestone represents, in hours. */
  readonly ageHours: number;
  /**
   * How late a capture may run and still count as this milestone. Snapshots do
   * not need to land on the exact second; they do need to be honest about it,
   * which is why the real age is stored alongside the target.
   */
  readonly toleranceHours: number;
  readonly labelHe: string;
  readonly shortLabelHe: string;
  readonly enabled: boolean;
}

/**
 * V1 captures 24h / 72h / 7d. The 6h, 14d and 30d rows exist so enabling them
 * later is a one-word change rather than a refactor.
 */
export const MILESTONES: readonly MilestoneConfig[] = [
  { target: 'h6', ageHours: 6, toleranceHours: 2, labelHe: '6 שעות', shortLabelHe: '6ש', enabled: false },
  { target: 'h24', ageHours: 24, toleranceHours: 6, labelHe: '24 שעות', shortLabelHe: '24ש', enabled: true },
  { target: 'h72', ageHours: 72, toleranceHours: 12, labelHe: '72 שעות', shortLabelHe: '72ש', enabled: true },
  { target: 'd7', ageHours: 168, toleranceHours: 24, labelHe: '7 ימים', shortLabelHe: '7י', enabled: true },
  { target: 'd14', ageHours: 336, toleranceHours: 36, labelHe: '14 ימים', shortLabelHe: '14י', enabled: false },
  { target: 'd30', ageHours: 720, toleranceHours: 48, labelHe: '30 ימים', shortLabelHe: '30י', enabled: false },
];

export const CURRENT_TARGET_LABEL_HE = 'נוכחי';

export function enabledMilestones(): readonly MilestoneConfig[] {
  return MILESTONES.filter((m) => m.enabled);
}

export function milestone(target: SnapshotTarget): MilestoneConfig | null {
  return MILESTONES.find((m) => m.target === target) ?? null;
}

export function milestoneLabel(target: SnapshotTarget): string {
  if (target === 'current') return CURRENT_TARGET_LABEL_HE;
  return milestone(target)?.labelHe ?? target;
}

export function videoAgeHours(publishedAt: string, now: Date = new Date()): number {
  const published = new Date(publishedAt).getTime();
  if (!Number.isFinite(published)) return 0;
  return Math.max(0, (now.getTime() - published) / 3_600_000);
}

/**
 * Milestones whose capture window is open right now for a video of this age and
 * which have not been captured yet. Used by the sync service.
 */
export function dueMilestones(
  ageHours: number,
  existing: readonly AnalyticsSnapshot[],
): readonly MilestoneConfig[] {
  const captured = new Set(
    existing
      .filter((s) => s.snapshotSource === 'milestone_capture')
      .map((s) => s.snapshotTarget),
  );
  return enabledMilestones().filter(
    (m) =>
      !captured.has(m.target) &&
      ageHours >= m.ageHours &&
      ageHours <= m.ageHours + m.toleranceHours,
  );
}

/**
 * A milestone whose window has already closed can never be captured honestly.
 * It may only be approximated from daily data, flagged as `daily_backfill`.
 */
export function missedMilestones(
  ageHours: number,
  existing: readonly AnalyticsSnapshot[],
): readonly MilestoneConfig[] {
  const present = new Set(existing.map((s) => s.snapshotTarget));
  return enabledMilestones().filter(
    (m) => !present.has(m.target) && ageHours > m.ageHours + m.toleranceHours,
  );
}

const SOURCE_PRECEDENCE: Record<SnapshotSource, number> = {
  milestone_capture: 3,
  current_state: 2,
  daily_backfill: 1,
};

/**
 * Best snapshot for a target: a real milestone capture wins over a daily
 * backfill approximation; among equals the most recent capture wins.
 */
export function selectSnapshot(
  snapshots: readonly AnalyticsSnapshot[],
  target: SnapshotTarget,
): AnalyticsSnapshot | null {
  const candidates = snapshots.filter((s) => s.snapshotTarget === target);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const bySource = SOURCE_PRECEDENCE[b.snapshotSource] - SOURCE_PRECEDENCE[a.snapshotSource];
    if (bySource !== 0) return bySource;
    return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
  })[0]!;
}

/** Targets that actually have data, in milestone order, `current` last. */
export function availableTargets(
  snapshots: readonly AnalyticsSnapshot[],
): readonly SnapshotTarget[] {
  const present = new Set(snapshots.map((s) => s.snapshotTarget));
  const ordered: SnapshotTarget[] = enabledMilestones()
    .map((m) => m.target)
    .filter((t) => present.has(t));
  if (present.has('current')) ordered.push('current');
  return ordered;
}

/**
 * Default target for the UI: the most mature milestone that exists, else the
 * current-state snapshot. Latest-stage-first matches how the dashboard reads.
 */
export function defaultTarget(snapshots: readonly AnalyticsSnapshot[]): SnapshotTarget | null {
  const targets = availableTargets(snapshots);
  const milestones = targets.filter((t) => t !== 'current');
  const last = milestones[milestones.length - 1];
  if (last) return last;
  return targets.includes('current') ? 'current' : null;
}

/**
 * Why a milestone cannot be shown — used to explain a disabled selector option
 * rather than silently hiding it.
 */
export type MilestoneUnavailableReason = 'too_young' | 'window_open' | 'never_captured';

export function milestoneUnavailableReason(
  target: SnapshotTarget,
  ageHours: number,
): MilestoneUnavailableReason {
  const config = milestone(target);
  if (!config) return 'never_captured';
  if (ageHours < config.ageHours) return 'too_young';
  if (ageHours <= config.ageHours + config.toleranceHours) return 'window_open';
  return 'never_captured';
}
