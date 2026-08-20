import type { ReactNode } from 'react';
import { MetricLabel, Skeleton } from './primitives';

/**
 * Empty and error states, transcribed from design 1e. Every state has a label,
 * a heading, an explanation and — where there is one — a real next action.
 */

export function EmptyState({
  kicker,
  title,
  body,
  action,
  icon,
  tone = 'neutral',
}: {
  kicker: string;
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'alert';
}) {
  return (
    <div className={`px-8 py-8 ${tone === 'alert' ? 'hero-glow-sm' : ''}`}>
      <MetricLabel className={tone === 'alert' ? 'text-accent-soft' : 'text-dim-2'}>
        {kicker}
      </MetricLabel>
      <div className="mt-5">
        {icon ?? (
          <div
            className={`flex size-11 items-center justify-center rounded-[10px] ${
              tone === 'alert'
                ? 'bg-accent/12 ring-1 ring-inset ring-accent/40 font-display text-[20px] leading-none font-semibold text-negative'
                : 'bg-panel ring-1 ring-inset ring-edge'
            }`}
          >
            {tone === 'alert' ? '!' : <span className="size-4 rounded-full ring-[1.5px] ring-dim-3" />}
          </div>
        )}
      </div>
      <h3 className="mt-4 font-display text-[18px] leading-[1.4] font-semibold text-fg">{title}</h3>
      <p className="mt-2 max-w-[400px] text-[13px] leading-[1.7] text-muted-2 text-pretty">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Inline notice used inside cards, e.g. an insufficient benchmark sample. */
export function InlineNotice({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent';
}) {
  return (
    <div
      className={`rounded-[8px] border border-line-strong bg-panel px-4 py-3 text-[13px] leading-[1.6] text-fg-3 ${
        tone === 'accent' ? 'border-e-2 border-e-accent' : ''
      }`}
    >
      {children}
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-4" />
      ))}
    </div>
  );
}

export function MetricStripSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-3 bg-canvas px-6 py-5">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}
