import Link from 'next/link';
import { NOTHING_TO_ATTEND_HE, type AttentionSignal } from '@/lib/analysis/attention';
import { SectionTitle } from '@/components/ui/primitives';

const TONES: Record<AttentionSignal['severity'], string> = {
  alert: 'bg-negative',
  watch: 'bg-accent',
  positive: 'bg-positive',
  info: 'bg-dim-3',
};

/**
 * Only real signals appear here. When the engine finds nothing, the card says
 * so plainly instead of being padded with filler warnings.
 */
export function AttentionCard({ signals }: { signals: readonly AttentionSignal[] }) {
  return (
    <section>
      <SectionTitle title="דורש תשומת לב" hint={signals.length > 0 ? `${signals.length} סימנים` : undefined} />

      {signals.length === 0 ? (
        <p className="mt-4 rounded-[8px] border border-line-strong bg-panel px-4 py-3.5 text-[13px] leading-[1.6] text-fg-3">
          {NOTHING_TO_ATTEND_HE}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {signals.map((signal) => (
            <li
              key={signal.id}
              className="rounded-[8px] border border-line-strong bg-panel px-4 py-3.5"
            >
              <div className="flex items-center gap-2.5">
                <span className={`size-1.5 shrink-0 rounded-full ${TONES[signal.severity]}`} aria-hidden />
                <h3 className="font-display text-[13px] leading-none font-semibold text-fg">
                  {signal.titleHe}
                </h3>
              </div>
              <p className="mt-2 text-[12.5px] leading-[1.6] text-muted">{signal.detailHe}</p>
              {signal.videoId ? (
                <Link
                  href={`/videos/${signal.videoId}`}
                  className="bidi-isolate mt-2 inline-block text-[12px] leading-none text-accent-soft transition-colors hover:text-accent"
                >
                  {signal.videoTitle ?? 'לסרטון'} ←
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
