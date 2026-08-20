/**
 * Robust statistics for benchmarking.
 *
 * Medians rather than means: a single viral video would otherwise drag the
 * "typical" line so far up that every normal upload looks like a failure.
 */

export function median(values: readonly number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const middle = Math.floor(clean.length / 2);
  if (clean.length % 2 === 1) return clean[middle]!;
  return (clean[middle - 1]! + clean[middle]!) / 2;
}

/** Median absolute deviation — the dispersion measure that pairs with a median. */
export function medianAbsoluteDeviation(values: readonly number[]): number | null {
  const center = median(values);
  if (center === null) return null;
  return median(values.map((v) => Math.abs(v - center)));
}

/**
 * Robust z-score using the MAD, scaled so it is comparable to a standard
 * z-score for normally distributed data (0.6745 = Phi^-1(0.75)).
 * Returns null when the peer set has no dispersion to speak of.
 */
export function robustZScore(value: number, peers: readonly number[]): number | null {
  const center = median(peers);
  const mad = medianAbsoluteDeviation(peers);
  if (center === null || mad === null || mad === 0) return null;
  return (0.6745 * (value - center)) / mad;
}

/** Share of peers this value is greater than, as 0-100. */
export function percentileRank(value: number, peers: readonly number[]): number | null {
  const clean = peers.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  const below = clean.filter((v) => v < value).length;
  const equal = clean.filter((v) => v === value).length;
  return ((below + equal / 2) / clean.length) * 100;
}

/**
 * Percentage difference from a reference value.
 * Returns null when the reference is 0 — "infinitely better than zero" is not a
 * number worth showing to a user.
 */
export function percentDifference(value: number, reference: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(reference)) return null;
  if (reference === 0) return null;
  return ((value - reference) / Math.abs(reference)) * 100;
}
