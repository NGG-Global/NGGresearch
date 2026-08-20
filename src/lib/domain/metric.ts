/**
 * A metric is never a bare number in this application.
 *
 * "0" and "we do not know" are different facts, and conflating them is the
 * fastest way to produce a misleading dashboard. Every metric therefore carries
 * an explicit state:
 *
 *  - available   — YouTube returned a value we can display and benchmark
 *  - pending     — the value legitimately does not exist yet (analytics latency,
 *                  Reporting API job still filling, video too new)
 *  - unavailable — the value cannot be obtained for this video/metric at all
 */
export type MetricState = 'available' | 'pending' | 'unavailable';

export interface MetricValue {
  readonly state: MetricState;
  readonly value: number | null;
  /** Short Hebrew explanation shown in place of the number. */
  readonly note?: string;
}

export function availableMetric(value: number): MetricValue {
  return { state: 'available', value };
}

export function pendingMetric(note = 'ממתין לנתוני YouTube'): MetricValue {
  return { state: 'pending', value: null, note };
}

export function unavailableMetric(note = 'לא זמין'): MetricValue {
  return { state: 'unavailable', value: null, note };
}

/**
 * Builds a metric from a possibly-missing API value.
 * `null`/`undefined`/non-finite input becomes `pending`, never 0.
 */
export function metricFrom(
  value: number | null | undefined,
  missing: MetricValue = pendingMetric(),
): MetricValue {
  if (value === null || value === undefined) return missing;
  if (typeof value !== 'number' || !Number.isFinite(value)) return missing;
  return availableMetric(value);
}

export function isAvailable(metric: MetricValue | null | undefined): boolean {
  return Boolean(metric && metric.state === 'available' && typeof metric.value === 'number');
}

/** Numeric value or `null` — the only supported way to read a metric for maths. */
export function metricNumber(metric: MetricValue | null | undefined): number | null {
  return isAvailable(metric) ? (metric as MetricValue).value : null;
}

/** Ratio of two metrics (e.g. subscribers per 1K views); null unless both exist. */
export function derivedRate(
  numerator: MetricValue | null | undefined,
  denominator: MetricValue | null | undefined,
  perUnits: number,
): MetricValue {
  const top = metricNumber(numerator);
  const bottom = metricNumber(denominator);
  if (top === null || bottom === null) return pendingMetric('דרוש מדד בסיס');
  if (bottom === 0) return unavailableMetric('אין צפיות לחישוב');
  return availableMetric((top / bottom) * perUnits);
}
