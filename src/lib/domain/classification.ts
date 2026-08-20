import type {
  ClassificationConfidence,
  ClassificationSource,
  ContentClassification,
  ContentType,
} from './types';

/**
 * YouTube's Data API v3 video resource has no authoritative "this is a Short"
 * field. Duration alone is a strong hint but not proof — a 50-second regular
 * upload is not a Short, and Shorts eligibility rules have changed over time.
 *
 * So we infer, record how we inferred it, and let a manual override win. The
 * benchmarking engine only ever compares videos of the same content type, and
 * refuses to treat low-confidence guesses as benchmark-eligible.
 */

/** Upper bound used by the duration heuristic, in seconds. */
export const SHORTS_DURATION_CEILING_SECONDS = 180;

/** Durations below this are almost certainly Shorts. */
const SHORTS_CONFIDENT_CEILING_SECONDS = 65;

export interface ClassificationInput {
  readonly durationSeconds: number | null;
  /** True when a HEAD/GET on /shorts/{id} resolved to the video (probe result). */
  readonly shortsProbe?: boolean | null;
  readonly isLiveBroadcast?: boolean | null;
  readonly manualOverride?: ContentType | null;
}

export function classifyVideo(input: ClassificationInput): ContentClassification {
  if (input.manualOverride) {
    return build(input.manualOverride, 'manual_override', 'high');
  }

  if (input.isLiveBroadcast) {
    return build('live', 'live_broadcast_flag', 'high');
  }

  if (input.shortsProbe === true) {
    return build('short', 'youtube_shorts_probe', 'high');
  }

  const duration = input.durationSeconds;
  if (duration === null || !Number.isFinite(duration) || duration <= 0) {
    return build('unknown', 'unknown', 'low');
  }

  if (duration <= SHORTS_CONFIDENT_CEILING_SECONDS) {
    return build('short', 'duration_heuristic', 'medium');
  }

  if (duration <= SHORTS_DURATION_CEILING_SECONDS) {
    // Ambiguous band: could be a Short or a short long-form upload. Never
    // benchmarked, because guessing wrong pollutes the comparison set.
    return build('unknown', 'duration_heuristic', 'low');
  }

  return build('long_form', 'duration_heuristic', 'high');
}

function build(
  contentType: ContentType,
  source: ClassificationSource,
  confidence: ClassificationConfidence,
): ContentClassification {
  return {
    contentType,
    source,
    confidence,
    benchmarkEligible: isBenchmarkEligible(contentType, confidence),
  };
}

/**
 * V1 benchmarks long-form only, and only when we are confident about the type.
 * Shorts, live streams and ambiguous videos are excluded from comparison sets.
 */
export function isBenchmarkEligible(
  contentType: ContentType,
  confidence: ClassificationConfidence,
): boolean {
  if (contentType !== 'long_form') return false;
  return confidence === 'high' || confidence === 'medium';
}

const CONTENT_TYPE_LABELS_HE: Record<ContentType, string> = {
  long_form: 'סרטון רגיל',
  short: 'Short',
  live: 'שידור חי',
  unknown: 'סוג לא ודאי',
};

export function contentTypeLabel(contentType: ContentType): string {
  return CONTENT_TYPE_LABELS_HE[contentType];
}

const SOURCE_LABELS_HE: Record<ClassificationSource, string> = {
  manual_override: 'הוגדר ידנית',
  youtube_shorts_probe: 'זוהה כ-Short על ידי YouTube',
  live_broadcast_flag: 'סומן כשידור חי',
  duration_heuristic: 'הוסק מאורך הסרטון',
  unknown: 'לא ניתן לקבוע',
};

export function classificationSourceLabel(source: ClassificationSource): string {
  return SOURCE_LABELS_HE[source];
}

/** ISO 8601 duration (`PT16M42S`) → seconds. Returns null on unparsable input. */
export function parseIsoDuration(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 86_400 +
    Number(hours ?? 0) * 3_600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
}
