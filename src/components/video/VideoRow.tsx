import Link from 'next/link';
import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { benchmarkOf } from '@/lib/analysis/video-analysis';
import { contentTypeLabel } from '@/lib/domain/classification';
import { pendingMetric } from '@/lib/domain/metric';
import { milestoneLabel } from '@/lib/domain/snapshots';
import { formatDuration, formatShortDate, formatVideoAge } from '@/lib/format';
import { formatMetricCell, type MetricCell } from '@/lib/format/metric';
import { StatusBadge } from '@/components/ui/indicators';
import { Thumbnail } from '@/components/ui/thumbnail';

/**
 * Compact video row used in the dashboard's recent-videos card.
 * The full table lives on the videos page.
 */
export function VideoRow({ analysis }: { analysis: VideoAnalysis }) {
  const { video } = analysis;
  const metrics = analysis.snapshot?.metrics;
  const viewsBenchmark = benchmarkOf(analysis, 'views');

  return (
    <Link
      href={`/videos/${video.id}`}
      className="flex items-center gap-3 border-b border-inset px-1 py-3 transition-colors last:border-b-0 hover:bg-panel/60"
    >
      <Thumbnail
        url={video.thumbnailUrl}
        title={video.title}
        durationSeconds={video.durationSeconds}
        showDuration={false}
        showLabel={false}
        muted={!video.classification.benchmarkEligible}
        className="w-16 shrink-0 rounded-[4px]"
        sizes="64px"
      />

      <div className="min-w-0 flex-1">
        <div className="bidi-isolate truncate font-display text-[13px] leading-[1.3] font-semibold text-fg">
          {video.title}
        </div>
        <div className="metric-label mt-1.5 truncate text-[10px] tracking-[0.04em] text-dim">
          {formatShortDate(video.publishedAt)} · {formatVideoAge(analysis.ageHours)}
          {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ''}
        </div>
      </div>

      <dl className="hidden shrink-0 gap-4 text-end sm:flex">
        <Cell label="VIEWS" cell={formatMetricCell('views', metrics?.views ?? pendingMetric())} />
        <Cell
          label="RET"
          cell={formatMetricCell(
            'averageViewPercentage',
            metrics?.averageViewPercentage ?? pendingMetric(),
          )}
        />
        <Cell
          label="SUBS"
          cell={formatMetricCell('subscribersGained', metrics?.subscribersGained ?? pendingMetric())}
        />
      </dl>

      <div className="shrink-0 text-end">
        <StatusBadge status={viewsBenchmark?.status ?? 'insufficient_data'} />
        <div className="metric-label mt-1.5 text-[9.5px] text-dim-2">
          {analysis.target
            ? milestoneLabel(analysis.target)
            : contentTypeLabel(video.classification.contentType)}
        </div>
      </div>
    </Link>
  );
}

function Cell({ label, cell }: { label: string; cell: MetricCell }) {
  return (
    <div className="w-[62px]">
      <dt className="metric-label text-[9.5px] text-dim">{label}</dt>
      <dd
        className={`num mt-1.5 text-[13px] leading-none ${cell.note ? 'text-dim-3' : 'text-fg-3'}`}
        title={cell.note ?? undefined}
      >
        {cell.text}
      </dd>
    </div>
  );
}
