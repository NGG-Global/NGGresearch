'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatRelativeAge } from '@/lib/format';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

interface SyncResponse {
  status?: string;
  warnings?: string[];
  error?: string;
  message?: string;
}

/**
 * Manual "סנכרן עכשיו" control. Shows syncing / success / failure inline and
 * refreshes the server components once the sync has written new data.
 */
export function SyncButton({
  lastSuccessfulSyncAt,
  disabled = false,
  disabledReason,
}: {
  lastSuccessfulSyncAt: string | null;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSync() {
    setState('syncing');
    setMessage(null);
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const body = (await response.json().catch(() => ({}))) as SyncResponse;

      if (!response.ok || body.status === 'failed') {
        setState('error');
        setMessage(body.error ?? body.message ?? 'הסנכרון נכשל.');
        return;
      }

      setState('success');
      setMessage(
        body.status === 'partial' && body.warnings?.length
          ? `הסתיים עם ${body.warnings.length} אזהרות`
          : 'הסנכרון הושלם',
      );
      startTransition(() => router.refresh());
    } catch {
      setState('error');
      setMessage('לא ניתן היה ליצור קשר עם השרת.');
    }
  }

  const busy = state === 'syncing' || isPending;

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5 text-[11.5px] leading-none text-dim">
        <span
          className={`size-1.5 rounded-full ${
            state === 'error'
              ? 'bg-negative'
              : busy
                ? 'animate-pulse bg-accent-soft'
                : lastSuccessfulSyncAt
                  ? 'bg-positive'
                  : 'bg-dim'
          }`}
          aria-hidden
        />
        {busy
          ? 'מסנכרן…'
          : message
            ? message
            : lastSuccessfulSyncAt
              ? `סונכרן ${formatRelativeAge(lastSuccessfulSyncAt)}`
              : 'לא סונכרן'}
      </span>
      <button
        type="button"
        onClick={handleSync}
        disabled={disabled || busy}
        title={disabled ? disabledReason : undefined}
        className="rounded-[6px] bg-chip px-3.5 py-2 text-[12.5px] leading-none text-fg-2 ring-1 ring-inset ring-edge-2 transition-colors hover:text-fg hover:ring-edge-3 disabled:cursor-not-allowed disabled:text-dim"
      >
        {busy ? 'מסנכרן…' : 'סנכרן עכשיו'}
      </button>
    </div>
  );
}
