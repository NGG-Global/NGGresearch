import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/config/env';
import { runSync } from '@/lib/sync/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Manual "סנכרן עכשיו" from the dashboard and settings. */
export async function POST() {
  if (isDemoMode()) {
    return NextResponse.json(
      { status: 'failed', error: 'סנכרון אינו זמין במצב הדגמה.' },
      { status: 400 },
    );
  }

  try {
    const result = await runSync({ trigger: 'manual' });
    return NextResponse.json(
      {
        status: result.status,
        videosProcessed: result.videosProcessed,
        snapshotsCreated: result.snapshotsCreated,
        warnings: result.warnings,
        error: result.error,
        finishedAt: result.finishedAt,
      },
      { status: result.status === 'failed' ? 502 : 200 },
    );
  } catch (error) {
    console.error('[sync] manual run threw', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { status: 'failed', error: 'הסנכרון נכשל באופן לא צפוי.' },
      { status: 500 },
    );
  }
}
