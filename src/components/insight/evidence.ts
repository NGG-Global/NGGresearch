import type { MetricBenchmark } from '@/lib/benchmark';
import { metricDefinition, type BenchmarkMetricKey } from '@/lib/benchmark';
import { formatSignedPercent } from '@/lib/format';
import { formatMetricValue } from '@/lib/format/metric';

export interface EvidenceItem {
  readonly label: string;
  readonly value: string;
  readonly reference: string | null;
  readonly text: string;
  readonly tone: 'positive' | 'negative' | 'neutral' | 'pending';
}

/** Metrics shown as evidence behind the verdict, in priority order. */
const EVIDENCE_METRICS: readonly BenchmarkMetricKey[] = [
  'impressionsCtr',
  'averageViewPercentage',
  'subscribersPer1kViews',
  'views',
];

/**
 * Turns benchmark results into the design's evidence cards.
 *
 * Every line is a statement of measured fact — value, median, sample size —
 * with no causal claim. Interpretation belongs to the insight text above it.
 */
export function buildEvidence(
  benchmarks: Readonly<Record<string, MetricBenchmark>>,
  limit = 4,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  for (const key of EVIDENCE_METRICS) {
    const benchmark = benchmarks[key];
    if (!benchmark) continue;
    const definition = metricDefinition(key);

    if (benchmark.metricState !== 'available' || benchmark.value === null) {
      items.push({
        label: definition.label,
        value: '—',
        reference: null,
        text:
          benchmark.metricState === 'pending'
            ? 'הנתון עדיין לא הגיע מ-YouTube ולכן לא נכנס לניתוח.'
            : 'הנתון אינו זמין לסרטון הזה.',
        tone: 'pending',
      });
      continue;
    }

    const value = formatMetricValue(key, benchmark.value);
    const reference =
      benchmark.benchmark !== null ? formatMetricValue(key, benchmark.benchmark) : null;

    items.push({
      label: definition.label,
      value,
      reference,
      text: describe(benchmark, definition.labelHe),
      tone:
        benchmark.status === 'exceptional' || benchmark.status === 'strong'
          ? 'positive'
          : benchmark.status === 'weak'
            ? 'negative'
            : 'neutral',
    });
  }

  return items.slice(0, limit);
}

function describe(benchmark: MetricBenchmark, labelHe: string): string {
  if (benchmark.percentDifference === null) {
    return `אין בסיס השוואה מספק ל${labelHe} בנקודה הזו (${benchmark.sampleSize} סרטונים דומים).`;
  }

  const direction = benchmark.percentDifference >= 0 ? 'מעל' : 'מתחת ל';
  const spread = benchmark.standsOutFromSpread
    ? ' הפער חורג מהפיזור הרגיל של הסדרה.'
    : '';

  return `${formatSignedPercent(benchmark.percentDifference)} ${direction}חציון של ${benchmark.sampleSize} סרטונים דומים באותה נקודת זמן.${spread}`;
}
