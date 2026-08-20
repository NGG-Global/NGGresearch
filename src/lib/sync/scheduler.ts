import 'server-only';
import { cronSecret } from '@/lib/config/env';
import type { SyncResult } from './service';
import { runSync } from './service';

/**
 * Scheduling boundary.
 *
 * The scheduler knows nothing about analytics, and the sync service knows
 * nothing about how it was triggered. Swapping Vercel Cron for GitHub Actions,
 * Supabase pg_cron or a queue means changing only this file and the route that
 * calls it.
 */

export type SchedulerAuthResult = { ok: true } | { ok: false; reason: string; status: number };

/**
 * Verifies a scheduled invocation.
 * Accepts the Vercel Cron header or a bearer/`?secret=` shared secret.
 */
export function authoriseScheduledRun(request: Request): SchedulerAuthResult {
  const secret = cronSecret();
  if (!secret) {
    return {
      ok: false,
      reason: 'Scheduled sync is not configured (CRON_SECRET missing).',
      status: 503,
    };
  }

  const header = request.headers.get('authorization');
  if (header === `Bearer ${secret}`) return { ok: true };

  const url = new URL(request.url);
  if (url.searchParams.get('secret') === secret) return { ok: true };

  return { ok: false, reason: 'Unauthorised scheduled invocation.', status: 401 };
}

export async function runScheduledSync(): Promise<SyncResult> {
  return runSync({ trigger: 'scheduled' });
}
