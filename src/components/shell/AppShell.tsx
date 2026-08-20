import type { ReactNode } from 'react';
import type { AppMode } from '@/lib/config/env';
import type { Channel } from '@/lib/domain/types';
import { TopNav, type NavTab } from './TopNav';

export function AppShell({
  channel,
  mode,
  active,
  children,
}: {
  channel: Channel | null;
  mode: AppMode;
  active: NavTab;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <TopNav channel={channel} mode={mode} active={active} />
      <main>{children}</main>
    </div>
  );
}
