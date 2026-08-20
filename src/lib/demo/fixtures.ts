/**
 * Demo fixtures for the "לילה לבן" channel.
 *
 * These feed the *same* domain models, benchmark engine and components as live
 * data — demo mode is a different data source, not a parallel fake UI.
 * Numbers are fixed (no randomness at request time) so the dashboard is stable
 * across renders and assertable in tests.
 */

export type DemoSnapshotStyle = 'tracked' | 'backfilled' | 'too_new';

export interface DemoVideoSpec {
  readonly youtubeVideoId: string;
  readonly title: string;
  readonly description: string;
  readonly series: string;
  /** Days before "now" that the video was published. */
  readonly publishedDaysAgo: number;
  readonly durationSeconds: number;
  readonly contentType: 'long_form' | 'short' | 'live';
  /** Lifetime-to-date figures. */
  readonly views: number;
  readonly averageViewPercentage: number;
  readonly subscribersGained: number;
  readonly subscribersLost: number;
  readonly likes: number;
  readonly comments: number;
  /** Impressions CTR in percent; null when reach reports do not cover it yet. */
  readonly impressionsCtr: number | null;
  readonly impressions: number | null;
  readonly snapshotStyle: DemoSnapshotStyle;
}

export const DEMO_CHANNEL = {
  youtubeChannelId: 'UC_demo_layla_lavan',
  title: 'לילה לבן',
  avatarUrl: '/brand/channel-avatar.png',
  subscriberCount: 128_400,
  videoCount: 47,
  viewCount: 12_430_000,
} as const;

export const DEMO_VIDEOS: readonly DemoVideoSpec[] = [
  {
    youtubeVideoId: 'demo-scp-049',
    title: 'SCP-049 — רופא המגפה',
    description: 'הסיפור המלא של SCP-049, אחת הישויות המסוקרות ביותר בקרן.',
    series: 'SCP',
    publishedDaysAgo: 3,
    durationSeconds: 16 * 60 + 42,
    contentType: 'long_form',
    views: 148_000,
    averageViewPercentage: 51,
    subscribersGained: 681,
    subscribersLost: 38,
    likes: 9_240,
    comments: 812,
    impressionsCtr: 8.2,
    impressions: 1_805_000,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-ikea',
    title: 'האיקאה האינסופית',
    description: 'קריפיפסטה על חנות שאין לה סוף, ועל מה שקורה למי שנשאר אחרי הסגירה.',
    series: 'קריפיפסטות',
    publishedDaysAgo: 11,
    durationSeconds: 21 * 60 + 8,
    contentType: 'long_form',
    views: 58_000,
    averageViewPercentage: 33,
    subscribersGained: 110,
    subscribersLost: 21,
    likes: 3_180,
    comments: 264,
    impressionsCtr: 5.1,
    impressions: 1_137_000,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-kraken',
    title: 'מאחורי הסיוט: הקראקן',
    description: 'איך מפלצת ימית מהמיתולוגיה הנורדית הפכה לסמל של אימה מודרנית.',
    series: 'מאחורי הסיוט',
    publishedDaysAgo: 18,
    durationSeconds: 18 * 60 + 20,
    contentType: 'long_form',
    views: 71_000,
    averageViewPercentage: 39,
    subscribersGained: 192,
    subscribersLost: 24,
    likes: 4_410,
    comments: 331,
    impressionsCtr: 7.4,
    impressions: 959_000,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-noend',
    title: 'NoEnd House — הבית שאין לו סוף',
    description: 'תשעה חדרים, פרס במזומן, ואף אחד לא מספר מה קורה בחדר התשיעי.',
    series: 'קריפיפסטות',
    publishedDaysAgo: 26,
    durationSeconds: 24 * 60 + 35,
    contentType: 'long_form',
    views: 92_000,
    averageViewPercentage: 45,
    subscribersGained: 341,
    subscribersLost: 29,
    likes: 5_870,
    comments: 498,
    impressionsCtr: 6.9,
    impressions: 1_333_000,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-hereditary',
    title: 'Hereditary — מאחורי הסיוט',
    description: 'פירוק הסוף של הסרט, והרמזים שהיו שם מהדקה הראשונה.',
    series: 'מאחורי הסיוט',
    publishedDaysAgo: 34,
    durationSeconds: 12 * 60 + 55,
    contentType: 'long_form',
    views: 44_000,
    averageViewPercentage: 29,
    subscribersGained: 62,
    subscribersLost: 18,
    likes: 2_140,
    comments: 187,
    impressionsCtr: 4.4,
    impressions: 1_000_000,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-scp-096',
    title: 'SCP-096 — הביישן',
    description: 'מה קורה כשמסתכלים על הפנים שאסור להסתכל עליהן.',
    series: 'SCP',
    publishedDaysAgo: 42,
    durationSeconds: 14 * 60 + 20,
    contentType: 'long_form',
    views: 118_000,
    averageViewPercentage: 48,
    subscribersGained: 502,
    subscribersLost: 33,
    likes: 7_640,
    comments: 621,
    impressionsCtr: 7.8,
    impressions: 1_513_000,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-kyiv-metro',
    title: 'הרכבת התחתית הסודית של קייב',
    description: 'מנהרות שלא מופיעות בשום מפה רשמית, ומה שנמצא בהן.',
    series: 'קריפיפסטות',
    publishedDaysAgo: 50,
    durationSeconds: 19 * 60 + 44,
    contentType: 'long_form',
    views: 63_000,
    averageViewPercentage: 36,
    subscribersGained: 148,
    subscribersLost: 22,
    likes: 3_520,
    comments: 291,
    // Reach reports do not reach this far back yet.
    impressionsCtr: null,
    impressions: null,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-babadook',
    title: 'מאחורי הסיוט: הבבדוק',
    description: 'ספר ילדים, אבל מהסוג שלא נגמר טוב.',
    series: 'מאחורי הסיוט',
    publishedDaysAgo: 58,
    durationSeconds: 17 * 60 + 5,
    contentType: 'long_form',
    views: 81_000,
    averageViewPercentage: 43,
    subscribersGained: 268,
    subscribersLost: 26,
    likes: 4_980,
    comments: 402,
    impressionsCtr: null,
    impressions: null,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-vanished-village',
    title: 'הכפר שנעלם מהמפה',
    description: 'שלוש מאות תושבים, יום אחד, ואף עדות אחת.',
    series: 'קריפיפסטות',
    publishedDaysAgo: 66,
    durationSeconds: 15 * 60 + 30,
    contentType: 'long_form',
    views: 52_000,
    averageViewPercentage: 31,
    subscribersGained: 96,
    subscribersLost: 19,
    likes: 2_760,
    comments: 208,
    impressionsCtr: null,
    impressions: null,
    // Predates milestone tracking: only day-granularity backfill exists.
    snapshotStyle: 'backfilled',
  },
  {
    youtubeVideoId: 'demo-scp-173',
    title: 'SCP-173 — הפסל',
    description: 'הראשון שנכתב, וגם זה שהתחיל את הכל.',
    series: 'SCP',
    publishedDaysAgo: 74,
    durationSeconds: 11 * 60 + 12,
    contentType: 'long_form',
    views: 104_000,
    averageViewPercentage: 46,
    subscribersGained: 388,
    subscribersLost: 31,
    likes: 6_310,
    comments: 511,
    impressionsCtr: null,
    impressions: null,
    snapshotStyle: 'backfilled',
  },
  {
    youtubeVideoId: 'demo-clark-house',
    title: 'הבית של קלרק',
    description: 'שיפוץ שגילה חדר שלא היה בתוכניות.',
    series: 'קריפיפסטות',
    publishedDaysAgo: 90,
    durationSeconds: 20 * 60 + 10,
    contentType: 'long_form',
    views: 47_000,
    averageViewPercentage: 34,
    subscribersGained: 121,
    subscribersLost: 20,
    likes: 2_480,
    comments: 176,
    impressionsCtr: null,
    impressions: null,
    snapshotStyle: 'backfilled',
  },
  {
    youtubeVideoId: 'demo-short-teaser',
    title: 'טיזר: מאחורי הסיוט, עונה 2',
    description: 'ארבעים ושמונה שניות.',
    series: 'מאחורי הסיוט',
    publishedDaysAgo: 7,
    durationSeconds: 48,
    contentType: 'short',
    views: 214_000,
    averageViewPercentage: 78,
    subscribersGained: 410,
    subscribersLost: 12,
    likes: 12_800,
    comments: 246,
    impressionsCtr: null,
    impressions: null,
    snapshotStyle: 'tracked',
  },
  {
    youtubeVideoId: 'demo-live-qa',
    title: 'שידור חי: שאלות ותשובות על אימה',
    description: 'שעה ורבע של שאלות מהקהל.',
    series: 'שידורים',
    publishedDaysAgo: 80,
    durationSeconds: 74 * 60,
    contentType: 'live',
    views: 19_000,
    averageViewPercentage: 22,
    subscribersGained: 34,
    subscribersLost: 9,
    likes: 980,
    comments: 640,
    impressionsCtr: null,
    impressions: null,
    snapshotStyle: 'tracked',
  },
];

/**
 * Share of the lifetime figure that had accumulated at each milestone.
 * Fixed, so demo benchmarks are reproducible.
 */
export const MILESTONE_ACCUMULATION = {
  h24: 0.24,
  h72: 0.46,
  d7: 0.63,
} as const;
