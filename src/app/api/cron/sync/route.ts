import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/config/env';
import { authoriseScheduledRun, runScheduledSync } from '@/lib/sync/scheduler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Scheduled sync endpoint.
 *
 * Deliberately thin: authorisation plus a call into the sync service. Swapping
 * the scheduler (Vercel Cron, GitHub Actions, pg_cron, a queue) touches only
 * this file and scheduler.ts, never the analytics logic.
 */
async function handle(request: Request) {
  const auth = authoriseScheduledRun(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  if (isDemoMode()) {
    return NextResponse.json({ status: 'skipped', reason: 'demo mode' });
  }

  const result = await runScheduledSync();
  return NextResponse.json(
    {
      status: result.status,
      videosProcessed: result.videosProcessed,
      snapshotsCreated: result.snapshotsCreated,
      warnings: result.warnings,
      error: result.error,
    },
    { status: result.status === 'failed' ? 502 : 200 },
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
