import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'outline' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-[0_4px_14px_rgba(224,21,33,0.3)] hover:bg-accent/90 focus-visible:outline-accent',
  outline:
    'text-fg-3 ring-1 ring-inset ring-edge-4 hover:text-fg hover:ring-dim-3 focus-visible:outline-edge-4',
  ghost: 'text-muted hover:text-fg focus-visible:outline-edge-3',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-[7px] px-4 py-2.5 text-[12.5px] leading-none font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'outline',
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'outline',
  className = '',
  children,
  href,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}
