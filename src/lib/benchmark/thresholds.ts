/**
 * Every threshold that turns a number into a judgement lives here, so the
 * grading model can be reviewed and changed in one place.
 */

export type PerformanceStatus =
  | 'exceptional'
  | 'strong'
  | 'typical'
  | 'weak'
  | 'insufficient_data';

/**
 * Minimum number of comparable peers before we are willing to call anything
 * typical, strong or weak. Below this the honest answer is "we don't know yet".
 */
export const MIN_BENCHMARK_SAMPLE = 5;

/** Peers used for a benchmark, newest first. */
export const MAX_BENCHMARK_PEERS = 10;

/**
 * Sample size from which we are willing to also report whether a value stands
 * out relative to the spread of the peer set (not a significance claim).
 */
export const MIN_SAMPLE_FOR_DISPERSION = 8;

/** |robust z| above which a value is considered to stand out from the spread. */
export const DISPERSION_STANDOUT_Z = 2;

/** Percentage-difference-from-median bands. */
export const STATUS_BANDS = {
  exceptional: 35,
  strong: 12,
  weak: -12,
} as const;

export function statusFromPercentDifference(
  percentDifference: number | null,
  higherIsBetter = true,
): PerformanceStatus {
  if (percentDifference === null || !Number.isFinite(percentDifference)) {
    return 'insufficient_data';
  }
  const oriented = higherIsBetter ? percentDifference : -percentDifference;
  if (oriented >= STATUS_BANDS.exceptional) return 'exceptional';
  if (oriented >= STATUS_BANDS.strong) return 'strong';
  if (oriented > STATUS_BANDS.weak) return 'typical';
  return 'weak';
}

const STATUS_LABELS_HE: Record<PerformanceStatus, string> = {
  exceptional: 'חריג לטובה',
  strong: 'חזק',
  typical: 'טיפוסי',
  weak: 'חלש',
  insufficient_data: 'אין מספיק נתונים',
};

export function statusLabel(status: PerformanceStatus): string {
  return STATUS_LABELS_HE[status];
}

/** The exact sentence to show when the benchmark cannot be trusted. */
export const INSUFFICIENT_BENCHMARK_MESSAGE_HE = 'עדיין אין מספיק נתונים להשוואה אמינה.';
