import Link from 'next/link';
import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { SectionTitle } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { VideoRow } from '@/components/video/VideoRow';

export function RecentVideos({ analyses }: { analyses: readonly VideoAnalysis[] }) {
  return (
    <section>
      <SectionTitle
        title="סרטונים אחרונים"
        hint={`${analyses.length} מהעלאות האחרונות`}
        action={
          <Link
            href="/videos"
            className="text-[12px] leading-none text-muted transition-colors hover:text-fg"
          >
            לכל הסרטונים
          </Link>
        }
      />

      {analyses.length === 0 ? (
        <div className="mt-3 rounded-[10px] border border-line-strong">
          <EmptyState
            kicker="EMPTY · NO VIDEOS"
            title="אין עדיין סרטונים"
            body="לאחר סנכרון ראשון הסרטונים של הערוץ יופיעו כאן."
          />
        </div>
      ) : (
        <div className="mt-3">
          {analyses.map((analysis) => (
            <VideoRow key={analysis.video.id} analysis={analysis} />
          ))}
        </div>
      )}
    </section>
  );
}
