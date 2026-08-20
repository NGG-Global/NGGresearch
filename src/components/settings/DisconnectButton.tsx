'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Disconnecting revokes the Google grant and deletes the stored channel.
 * It is destructive, so it asks first.
 */
export function DisconnectButton({ disabled, disabledReason }: { disabled?: boolean; disabledReason?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/disconnect', { method: 'POST' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'הניתוק נכשל.');
        setBusy(false);
        return;
      }
      router.push('/connect');
    } catch {
      setError('לא ניתן היה ליצור קשר עם השרת.');
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <span
        className="rounded-[7px] px-4 py-2.5 text-[12px] leading-none font-semibold text-dim-3 ring-1 ring-inset ring-line-strong"
        title={disabledReason}
      >
        נתק
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-[7px] px-4 py-2.5 text-[12px] leading-none font-semibold text-fg-3 ring-1 ring-inset ring-edge-4 transition-colors hover:text-fg"
      >
        נתק
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="rounded-[7px] bg-accent px-4 py-2.5 text-[12px] leading-none font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? 'מנתק…' : 'לנתק בוודאות'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-[7px] px-3 py-2.5 text-[12px] leading-none text-muted transition-colors hover:text-fg"
        >
          ביטול
        </button>
      </div>
      {error ? <span className="text-[11.5px] leading-none text-negative">{error}</span> : null}
    </div>
  );
}
