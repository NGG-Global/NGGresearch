import { describe, expect, it } from 'vitest';
import {
  formatCompact,
  formatDuration,
  formatPercent,
  formatRelativeAge,
  formatShortDate,
  formatSignedPercent,
  formatVideoAge,
  formatWatchHours,
} from '@/lib/format';
import { formatMetric, formatMetricCell, formatMetricValue } from '@/lib/format/metric';
import { availableMetric, pendingMetric, unavailableMetric } from '@/lib/domain/metric';
import { NOW } from './fixtures';

describe('formatCompact', () => {
  it('matches the design figures', () => {
    expect(formatCompact(412_000)).toBe('412K');
    expect(formatCompact(52_800)).toBe('52.8K');
    expect(formatCompact(148_000)).toBe('148K');
    expect(formatCompact(58_000)).toBe('58K');
  });

  it('handles millions and small numbers', () => {
    expect(formatCompact(1_240_000)).toBe('1.2M');
    expect(formatCompact(620)).toBe('620');
    expect(formatCompact(0)).toBe('0');
  });
});

describe('formatPercent and deltas', () => {
  it('honours the requested precision', () => {
    expect(formatPercent(8.2, 1)).toBe('8.2%');
    expect(formatPercent(51, 0)).toBe('51%');
    expect(formatPercent(6.0, 1)).toBe('6%');
  });

  it('signs a difference explicitly', () => {
    expect(formatSignedPercent(32)).toBe('+32%');
    expect(formatSignedPercent(-8)).toBe('-8%');
    expect(formatSignedPercent(0)).toBe('0%');
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(1002)).toBe('16:42');
    expect(formatDuration(461)).toBe('7:41');
    expect(formatDuration(5)).toBe('0:05');
  });

  it('adds hours past sixty minutes', () => {
    expect(formatDuration(3735)).toBe('1:02:15');
  });
});

describe('formatWatchHours', () => {
  it('converts stored minutes into display hours', () => {
    expect(formatWatchHours(60)).toBe('1.0');
    expect(formatWatchHours(3_168_000)).toBe('52.8K');
  });
});

describe('dates and ages', () => {
  it('formats the short table date', () => {
    expect(formatShortDate('2026-03-12T00:00:00.000Z')).toBe('12.3.26');
  });

  it('describes relative age in Hebrew', () => {
    const twelveMinutesAgo = new Date(NOW.getTime() - 12 * 60_000).toISOString();
    expect(formatRelativeAge(twelveMinutesAgo, NOW)).toBe('לפני 12 דקות');

    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 3_600_000).toISOString();
    expect(formatRelativeAge(threeDaysAgo, NOW)).toBe('לפני 3 ימים');
  });

  it('uses hours for a young video and days later on', () => {
    expect(formatVideoAge(30)).toBe('30 שעות');
    expect(formatVideoAge(72)).toBe('3 ימים');
  });

  it('never renders an invalid date as a number', () => {
    expect(formatShortDate('not-a-date')).toBe('—');
    expect(formatRelativeAge('not-a-date', NOW)).toBe('—');
  });
});

describe('metric formatting', () => {
  it('formats each metric in its own unit', () => {
    expect(formatMetricValue('views', 148_000)).toBe('148K');
    expect(formatMetricValue('impressionsCtr', 8.2)).toBe('8.2%');
    expect(formatMetricValue('averageViewPercentage', 51)).toBe('51%');
    expect(formatMetricValue('averageViewDurationSeconds', 461)).toBe('7:41');
    expect(formatMetricValue('subscribersPer1kViews', 4.6)).toBe('4.6');
  });

  it('shows a measured zero as zero', () => {
    expect(formatMetric('views', availableMetric(0))).toBe('0');
  });

  it('never shows an absent metric as zero', () => {
    expect(formatMetric('views', pendingMetric())).not.toBe('0');
    expect(formatMetric('impressions', unavailableMetric())).not.toBe('0');
  });

  it('collapses absent values to an em dash with the reason in a note', () => {
    const pending = formatMetricCell('impressionsCtr', pendingMetric('ממתין לדוח חשיפות'));
    expect(pending.text).toBe('—');
    expect(pending.note).toBe('ממתין לדוח חשיפות');

    const present = formatMetricCell('views', availableMetric(148_000));
    expect(present.text).toBe('148K');
    expect(present.note).toBeNull();
  });

  it('distinguishes a measured zero from an unknown in a table cell', () => {
    expect(formatMetricCell('views', availableMetric(0)).text).toBe('0');
    expect(formatMetricCell('views', pendingMetric()).text).toBe('—');
  });
});
