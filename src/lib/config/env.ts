/**
 * Single place where environment variables are read and validated.
 * Nothing here is imported from client components — every consumer is a server
 * module, a route handler or a server action.
 */

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for the full list.`,
    );
  }
  return value;
}

export type AppMode = 'demo' | 'live';

/** Demo mode is the default so the UI runs with no credentials at all. */
export function appMode(): AppMode {
  const explicit = optional('APP_MODE');
  if (explicit === 'demo' || explicit === 'live') return explicit;
  return hasSupabaseConfig() && hasGoogleOAuthConfig() ? 'live' : 'demo';
}

export function isDemoMode(): boolean {
  return appMode() === 'demo';
}

export function hasSupabaseConfig(): boolean {
  return Boolean(optional('SUPABASE_URL') && optional('SUPABASE_SERVICE_ROLE_KEY'));
}

export function hasGoogleOAuthConfig(): boolean {
  return Boolean(
    optional('GOOGLE_CLIENT_ID') && optional('GOOGLE_CLIENT_SECRET') && optional('APP_BASE_URL'),
  );
}

export function supabaseConfig() {
  return {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

export function googleOAuthConfig() {
  const baseUrl = required('APP_BASE_URL').replace(/\/$/, '');
  return {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    redirectUri: `${baseUrl}/api/auth/google/callback`,
    baseUrl,
  };
}

export function encryptionKey(): string {
  return required('APP_ENCRYPTION_KEY');
}

export function sessionSecret(): string {
  return required('APP_SESSION_SECRET');
}

export function cronSecret(): string | undefined {
  return optional('CRON_SECRET');
}

export function anthropicConfig() {
  const apiKey = optional('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  return {
    apiKey,
    model: optional('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5',
    maxTokens: Number(optional('ANTHROPIC_MAX_TOKENS') ?? '1200'),
  };
}

export function aiInsightsEnabled(): boolean {
  if (optional('AI_INSIGHTS_ENABLED') === 'false') return false;
  return anthropicConfig() !== null;
}

/** Report type id for the Reporting API reach report (thumbnail impressions + CTR). */
export function reachReportTypeId(): string {
  return optional('YOUTUBE_REPORTING_REACH_REPORT_TYPE') ?? 'channel_reach_basic_a1';
}

export function reportingApiEnabled(): boolean {
  return optional('YOUTUBE_REPORTING_ENABLED') !== 'false';
}

export interface SyncLimits {
  /** Videos whose metadata is refreshed each run. */
  readonly maxMetadataVideos: number;
  /** Newest videos for which analytics totals and snapshots are fetched. */
  readonly maxAnalyticsVideos: number;
  /** Newest videos for which per-day analytics are fetched. */
  readonly maxDailyVideos: number;
}

export function syncLimits(): SyncLimits {
  return {
    maxMetadataVideos: toPositiveInt(optional('SYNC_MAX_METADATA_VIDEOS'), 200),
    maxAnalyticsVideos: toPositiveInt(optional('SYNC_MAX_ANALYTICS_VIDEOS'), 60),
    maxDailyVideos: toPositiveInt(optional('SYNC_MAX_DAILY_VIDEOS'), 30),
  };
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
