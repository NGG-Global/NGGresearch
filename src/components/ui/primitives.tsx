import type { ReactNode } from 'react';

/**
 * Low-level pieces transcribed from the design. Every visual value comes from a
 * token in globals.css — components must not introduce new hex values.
 */

export function MetricLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`metric-label text-[10px] leading-none text-dim ${className}`}>{children}</div>;
}

/** LTR-isolated figure in the display face. */
export function Figure({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`num ${className}`}>{children}</span>;
}

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[10px] border border-line-strong bg-panel ${className}`}>{children}</div>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="font-display text-[15px] leading-none font-semibold text-fg">{title}</h2>
      {hint ? <span className="text-[11.5px] leading-none text-dim-2">{hint}</span> : null}
      {action ? (
        <>
          <div className="flex-1" />
          {action}
        </>
      ) : null}
    </div>
  );
}

export function Hairline({ className = '' }: { className?: string }) {
  return <div className={`h-px w-full bg-line ${className}`} />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} aria-hidden />;
}
