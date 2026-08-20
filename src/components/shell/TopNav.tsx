import Image from 'next/image';
import Link from 'next/link';
import type { AppMode } from '@/lib/config/env';
import type { Channel } from '@/lib/domain/types';
import { SyncButton } from './SyncButton';

const TABS = [
  { href: '/', label: 'סקירה' },
  { href: '/videos', label: 'סרטונים' },
  { href: '/settings', label: 'הגדרות' },
] as const;

export type NavTab = (typeof TABS)[number]['href'];

const FALLBACK_AVATAR = '/brand/channel-avatar.png';

/** Top navigation bar, transcribed from the design's header (14px / 32px). */
export function TopNav({
  channel,
  mode,
  active,
}: {
  channel: Channel | null;
  mode: AppMode;
  active: NavTab;
}) {
  const disconnected = !channel || channel.tokenStatus !== 'valid';

  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-hair bg-surface px-6 py-3.5 lg:px-8">
      <Link href="/" className="flex items-center gap-2.5" aria-label="לילה לבן — דף הבית">
        <Image
          src={channel?.avatarUrl ?? FALLBACK_AVATAR}
          alt=""
          width={34}
          height={34}
          className="size-[34px] rounded-full shadow-[0_0_0_1px_#2a2a32,0_0_14px_rgba(224,21,33,0.28)]"
        />
        <span className="block">
          <span className="block font-display text-[15px] leading-[1.15] font-semibold tracking-[-0.01em] text-fg">
            {channel?.title ?? 'לילה לבן'}
          </span>
          <span className="metric-label mt-0.5 block text-[10px] leading-[1.3] tracking-[0.06em] text-dim">
            CHANNEL INTELLIGENCE
          </span>
        </span>
      </Link>

      <div className="mx-1 hidden h-[26px] w-px bg-edge sm:block" aria-hidden />

      <nav className="flex gap-1 text-[13.5px] leading-none" aria-label="ניווט ראשי">
        {TABS.map((tab) => {
          const isActive = tab.href === active;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'rounded-[6px] bg-nav-active px-3.5 py-2 font-semibold text-fg ring-1 ring-inset ring-edge-2'
                  : 'rounded-[6px] px-3.5 py-2 text-muted transition-colors hover:text-fg'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {mode === 'demo' ? (
        <span
          className="metric-label rounded-[5px] bg-accent/10 px-2 py-1.5 text-[10px] text-accent-soft ring-1 ring-inset ring-accent/25"
          title="הנתונים המוצגים הם נתוני הדגמה, לא נתוני YouTube אמיתיים"
        >
          DEMO DATA
        </span>
      ) : null}

      <SyncButton
        lastSuccessfulSyncAt={channel?.lastSuccessfulSyncAt ?? null}
        disabled={mode === 'demo' || disconnected}
        disabledReason={
          mode === 'demo' ? 'סנכרון אינו זמין במצב הדגמה' : 'יש להתחבר מחדש ל-YouTube'
        }
      />
    </header>
  );
}
