import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-[520px] rounded-[10px] border border-line-strong bg-canvas px-8 py-10">
        <div className="metric-label text-[9.5px] tracking-[0.12em] text-dim-2">NOT FOUND</div>
        <h1 className="mt-5 font-display text-[20px] leading-[1.4] font-semibold text-fg">
          הדף או הסרטון לא נמצאו
        </h1>
        <p className="mt-2.5 text-[13px] leading-[1.7] text-muted-2">
          ייתכן שהסרטון נמחק מהערוץ, או שהקישור אינו תקין.
        </p>
        <Link
          href="/videos"
          className="mt-6 inline-flex rounded-[7px] px-4 py-2.5 text-[12.5px] leading-none font-semibold text-fg-3 ring-1 ring-inset ring-edge-4 transition-colors hover:text-fg"
        >
          לרשימת הסרטונים
        </Link>
      </div>
    </div>
  );
}
