import { metricDefinition, type BenchmarkMetricKey } from '@/lib/benchmark/metrics';
import type { MetricValue } from '@/lib/domain/metric';
import {
  formatCompact,
  formatDecimal,
  formatDuration,
  formatPercent,
  formatWatchHours,
} from './index';

/** Single place that turns a raw metric number into display text. */
export function formatMetricValue(key: BenchmarkMetricKey, value: number): string {
  const definition = metricDefinition(key);
  switch (definition.unit) {
    case 'percent':
      return formatPercent(value, definition.decimals);
    case 'seconds':
      return formatDuration(value);
    case 'minutes':
      return formatWatchHours(value);
    case 'rate':
      return formatDecimal(value, definition.decimals);
    case 'count':
    default:
      return formatCompact(value);
  }
}

/** Suffix shown next to a value where the unit is not obvious from the number. */
export function metricUnitSuffix(key: BenchmarkMetricKey): string | null {
  return metricDefinition(key).unit === 'minutes' ? 'שעות' : null;
}

/** Display text for a metric, honouring pending/unavailable states. */
export function formatMetric(key: BenchmarkMetricKey, metric: MetricValue): string {
  if (metric.state !== 'available' || metric.value === null) {
    return metric.note ?? (metric.state === 'pending' ? 'ממתין' : 'לא זמין');
  }
  return formatMetricValue(key, metric.value);
}

export interface MetricCell {
  readonly text: string;
  /** Reason a value is absent, for a tooltip. Null when the value exists. */
  readonly note: string | null;
}

/**
 * Compact form for dense contexts like table cells: an em dash carries the
 * "unknown" meaning and the reason moves into a tooltip, so rows keep a single
 * line height and a missing value still cannot read as zero.
 */
export function formatMetricCell(key: BenchmarkMetricKey, metric: MetricValue): MetricCell {
  if (metric.state === 'available' && metric.value !== null) {
    return { text: formatMetricValue(key, metric.value), note: null };
  }
  return {
    text: '—',
    note: metric.note ?? (metric.state === 'pending' ? 'ממתין לנתונים מ-YouTube' : 'הנתון אינו זמין'),
  };
}
