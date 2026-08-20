'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { MetricLabel } from '@/components/ui/primitives';

export interface SnapshotOption {
  readonly target: string;
  readonly label: string;
  readonly available: boolean;
  /** Why the milestone cannot be selected — shown instead of hiding it. */
  readonly reason: string | null;
}

/**
 * Milestone selector for the video detail page.
 *
 * Unavailable milestones stay visible but disabled and carry the reason, so a
 * gap in the data reads as a gap rather than as a missing feature.
 */
export function SnapshotSelector({
  options,
  active,
}: {
  options: readonly SnapshotOption[];
  active: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(target: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('snapshot', target);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <MetricLabel className="tracking-[0.1em]">SNAPSHOT</MetricLabel>
      <div
        className={`flex flex-wrap gap-1.5 ${isPending ? 'opacity-60' : ''}`}
        role="group"
        aria-label="בחירת נקודת מדידה"
      >
        {options.map((option) => {
          const isActive = option.target === active;
          return (
            <button
              key={option.target}
              type="button"
              disabled={!option.available}
              aria-pressed={isActive}
              title={option.reason ?? undefined}
              onClick={() => select(option.target)}
              className={
                isActive
                  ? 'rounded-[6px] bg-chip-strong px-3.5 py-2 text-[12.5px] leading-none font-semibold text-fg ring-1 ring-inset ring-edge-2'
                  : option.available
                    ? 'rounded-[6px] px-3.5 py-2 text-[12.5px] leading-none text-muted ring-1 ring-inset ring-edge transition-colors hover:text-fg'
                    : 'cursor-not-allowed rounded-[6px] px-3.5 py-2 text-[12.5px] leading-none text-dim-3 ring-1 ring-inset ring-line-strong'
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
