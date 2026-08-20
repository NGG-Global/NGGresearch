'use client';

import Link from 'next/link';

/** Last-resort boundary: an exception must never produce a blank page. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="hero-glow-sm w-full max-w-[520px] rounded-[10px] border border-line-strong bg-canvas px-8 py-10">
        <div className="metric-label text-[9.5px] tracking-[0.12em] text-accent-soft">
          ERROR · UNEXPECTED
        </div>
        <h1 className="mt-5 font-display text-[20px] leading-[1.4] font-semibold text-fg">
          משהו נשבר בדרך
        </h1>
        <p className="mt-2.5 text-[13px] leading-[1.7] text-muted-2">
          התקלה נרשמה בצד השרת. אפשר לנסות לטעון מחדש; אם זה חוזר, כדאי לבדוק את יומני השרת.
        </p>
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="rounded-[7px] bg-accent px-4 py-2.5 text-[12.5px] leading-none font-semibold text-white transition-colors hover:bg-accent/90"
          >
            נסה שוב
          </button>
          <Link
            href="/"
            className="rounded-[7px] px-4 py-2.5 text-[12.5px] leading-none font-semibold text-fg-3 ring-1 ring-inset ring-edge-4 transition-colors hover:text-fg"
          >
            חזרה לסקירה
          </Link>
        </div>
      </div>
    </div>
  );
}
