/**
 * Errors from Google are wrapped so route handlers can decide what the user is
 * told without ever leaking tokens, keys or raw upstream payloads.
 */
export type YouTubeErrorKind =
  | 'auth_expired'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'data_pending'
  | 'upstream'
  | 'unknown';

export class YouTubeApiError extends Error {
  readonly kind: YouTubeErrorKind;
  readonly status: number | null;
  readonly api: string;

  constructor(params: { message: string; kind: YouTubeErrorKind; status?: number | null; api: string }) {
    super(params.message);
    this.name = 'YouTubeApiError';
    this.kind = params.kind;
    this.status = params.status ?? null;
    this.api = params.api;
  }
}

export function kindFromStatus(status: number): YouTubeErrorKind {
  if (status === 401) return 'auth_expired';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'upstream';
  return 'unknown';
}

/** Short Hebrew sentence safe to show a user for each failure kind. */
const MESSAGES_HE: Record<YouTubeErrorKind, string> = {
  auth_expired: 'החיבור ל-YouTube פג. יש להתחבר מחדש.',
  forbidden: 'ל-YouTube אין הרשאה להחזיר את הנתונים האלה. כדאי לבדוק את ההרשאות שאושרו.',
  not_found: 'הנתון המבוקש לא נמצא ב-YouTube.',
  rate_limited: 'YouTube הגביל את קצב הבקשות. כדאי לנסות שוב בהמשך.',
  data_pending: 'הנתונים עדיין לא זמינים ב-YouTube.',
  upstream: 'שירות YouTube לא זמין כרגע.',
  unknown: 'שגיאה לא מזוהה בתקשורת עם YouTube.',
};

export function userMessageFor(kind: YouTubeErrorKind): string {
  return MESSAGES_HE[kind];
}

export function toUserMessage(error: unknown): string {
  if (error instanceof YouTubeApiError) return userMessageFor(error.kind);
  return 'שגיאה לא מזוהה. הנתונים המוצגים עשויים להיות לא מעודכנים.';
}
