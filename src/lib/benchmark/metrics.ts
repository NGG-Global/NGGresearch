import { derivedRate, metricNumber, type MetricValue } from '@/lib/domain/metric';
import type { SnapshotMetrics } from '@/lib/domain/types';

export type BenchmarkMetricKey =
  | 'views'
  | 'averageViewPercentage'
  | 'averageViewDurationSeconds'
  | 'watchTimeMinutes'
  | 'subscribersPer1kViews'
  | 'subscribersGained'
  | 'subscribersLost'
  | 'impressionsCtr'
  | 'impressions'
  | 'likes'
  | 'comments';

export type MetricUnit = 'count' | 'percent' | 'seconds' | 'minutes' | 'rate';

export interface MetricDefinition {
  readonly key: BenchmarkMetricKey;
  /** Short Latin label, as used in the design's metric chips. */
  readonly label: string;
  readonly labelHe: string;
  readonly unit: MetricUnit;
  readonly decimals: number;
  /** false for metrics where a lower number is the better outcome. */
  readonly higherIsBetter: boolean;
  readonly read: (metrics: SnapshotMetrics) => MetricValue;
}

export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    key: 'views',
    label: 'VIEWS',
    labelHe: 'צפיות',
    unit: 'count',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.views,
  },
  {
    key: 'averageViewPercentage',
    label: 'RETENTION',
    labelHe: 'אחוז צפייה ממוצע',
    unit: 'percent',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.averageViewPercentage,
  },
  {
    key: 'averageViewDurationSeconds',
    label: 'AVG VIEW DURATION',
    labelHe: 'משך צפייה ממוצע',
    unit: 'seconds',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.averageViewDurationSeconds,
  },
  {
    key: 'watchTimeMinutes',
    label: 'WATCH TIME',
    labelHe: 'זמן צפייה',
    unit: 'minutes',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.watchTimeMinutes,
  },
  {
    key: 'subscribersPer1kViews',
    label: 'SUBS / 1K',
    labelHe: 'מנויים לכל 1000 צפיות',
    unit: 'rate',
    decimals: 1,
    higherIsBetter: true,
    read: (m) => derivedRate(m.subscribersGained, m.views, 1_000),
  },
  {
    key: 'subscribersGained',
    label: 'NEW SUBS',
    labelHe: 'מנויים חדשים',
    unit: 'count',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.subscribersGained,
  },
  {
    key: 'subscribersLost',
    label: 'LOST SUBS',
    labelHe: 'מנויים שאבדו',
    unit: 'count',
    decimals: 0,
    // Fewer unsubscribes is the better outcome, so the benchmark is inverted.
    higherIsBetter: false,
    read: (m) => m.subscribersLost,
  },
  {
    key: 'impressionsCtr',
    label: 'IMPRESSIONS CTR',
    labelHe: 'אחוז הקלקה על התמונה',
    unit: 'percent',
    decimals: 1,
    higherIsBetter: true,
    read: (m) => m.impressionsCtr,
  },
  {
    key: 'impressions',
    label: 'IMPRESSIONS',
    labelHe: 'חשיפות',
    unit: 'count',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.impressions,
  },
  {
    key: 'likes',
    label: 'LIKES',
    labelHe: 'לייקים',
    unit: 'count',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.likes,
  },
  {
    key: 'comments',
    label: 'COMMENTS',
    labelHe: 'תגובות',
    unit: 'count',
    decimals: 0,
    higherIsBetter: true,
    read: (m) => m.comments,
  },
];

const BY_KEY = new Map(METRIC_DEFINITIONS.map((d) => [d.key, d]));

export function metricDefinition(key: BenchmarkMetricKey): MetricDefinition {
  const definition = BY_KEY.get(key);
  if (!definition) throw new Error(`Unknown benchmark metric: ${key}`);
  return definition;
}

export function readMetric(metrics: SnapshotMetrics, key: BenchmarkMetricKey): MetricValue {
  return metricDefinition(key).read(metrics);
}

export function readMetricNumber(
  metrics: SnapshotMetrics,
  key: BenchmarkMetricKey,
): number | null {
  return metricNumber(readMetric(metrics, key));
}
