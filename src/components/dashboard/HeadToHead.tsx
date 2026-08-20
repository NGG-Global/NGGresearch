import Link from 'next/link';
import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { metricDefinition, type BenchmarkMetricKey } from '@/lib/benchmark';
import { contentTypeLabel } from '@/lib/domain/classification';
import { metricNumber, pendingMetric } from '@/lib/domain/metric';
import { readMetric } from '@/lib/benchmark/metrics';
import { formatDuration, formatShortDate, formatSignedPercent } from '@/lib/format';
import { formatMetric, formatMetricValue } from '@/lib/format/metric';
import { percentDifference } from '@/lib/benchmark/statistics';
import { MetricLabel, SectionTitle } from '@/components/ui/primitives';
import { Thumbnail } from '@/components/ui/thumbnail';
import { InlineNotice } from '@/components/ui/states';

const COMPARED_METRICS: readonly BenchmarkMetricKey[] = [
  'impressionsCtr',
  'averageViewPercentage',
  'subscribersPer1kViews',
  'views',
];

/**
 * "סרטון מול סרטון" from design 1a: the newest upload beside the previous
 * comparable one, on identical metrics at each video's own selected snapshot.
 */
export function HeadToHead({
  subject,
  previous,
}: {
  subject: VideoAnalysis;
  previous: VideoAnalysis | null;
}) {
  return (
    <section>
      <SectionTitle
        title="סרטון מול סרטון"
        hint="שני האחרונים · אותם מדדים"
        action={
          previous ? (
            <Link
              href={`/videos/${previous.video.id}`}
              className="text-[12px] leading-none text-muted transition-colors hover:text-fg"
            >
              לניתוח המלא
            </Link>
          ) : undefined
        }
      />

      <div className="mt-4.5 grid gap-4.5 md:grid-cols-2">
        <VideoPanel analysis={subject} emphasis />
        {previous ? (
          <VideoPanel analysis={previous} emphasis={false} />
        ) : (
          <div className="flex items-center rounded-[10px] border border-line-strong bg-panel px-5 py-6 text-[13px] leading-[1.7] text-muted-2">
            אין עדיין סרטון קודם בר-השוואה מאותו סוג תוכן.
          </div>
        )}
      </div>

      {previous ? <ComparisonNote subject={subject} previous={previous} /> : null}
    </section>
  );
}

function VideoPanel({ analysis, emphasis }: { analysis: VideoAnalysis; emphasis: boolean }) {
  const { video } = analysis;
  const valueTone = emphasis ? 'text-fg' : 'text-muted';

  return (
    <Link
      href={`/videos/${video.id}`}
      className="block overflow-hidden rounded-[10px] border border-line-strong bg-panel transition-colors hover:border-edge-3"
    >
      <Thumbnail
        url={video.thumbnailUrl}
        title={video.title}
        durationSeconds={video.durationSeconds}
        muted={!emphasis}
        sizes="(max-width: 768px) 100vw, 320px"
      />
      <div className="px-4 py-3.5">
        <MetricLabel className={`text-[10px] tracking-[0.08em] ${emphasis ? 'text-accent-soft' : 'text-dim'}`}>
          {contentTypeLabel(video.classification.contentType)}
          {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ''}
        </MetricLabel>
        <h3 className="bidi-isolate mt-2 line-clamp-2 font-display text-[14px] leading-[1.45] font-semibold text-fg">
          {video.title}
        </h3>

        <dl className="mt-3.5 grid gap-2.5 border-t border-hair pt-3.5">
          {COMPARED_METRICS.map((key) => {
            const metric = analysis.snapshot
              ? readMetric(analysis.snapshot.metrics, key)
              : pendingMetric();
            return (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="metric-label text-[10px] text-dim">{metricDefinition(key).label}</dt>
                <dd className={`num text-[14px] leading-none font-semibold ${valueTone}`}>
                  {formatMetric(key, metric)}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="metric-label mt-3 text-[9.5px] tracking-[0.04em] text-dim-2">
          {formatShortDate(video.publishedAt)}
        </p>
      </div>
    </Link>
  );
}

/** The widest measured gap between the two videos, stated without a cause. */
function ComparisonNote({
  subject,
  previous,
}: {
  subject: VideoAnalysis;
  previous: VideoAnalysis;
}) {
  let widest: { key: BenchmarkMetricKey; difference: number } | null = null;

  for (const key of COMPARED_METRICS) {
    if (!subject.snapshot || !previous.snapshot) break;
    const a = metricNumber(readMetric(subject.snapshot.metrics, key));
    const b = metricNumber(readMetric(previous.snapshot.metrics, key));
    if (a === null || b === null) continue;
    const difference = percentDifference(a, b);
    if (difference === null) continue;
    if (!widest || Math.abs(difference) > Math.abs(widest.difference)) {
      widest = { key, difference };
    }
  }

  if (!widest) {
    return (
      <div className="mt-4">
        <InlineNotice>אין מדדים משותפים זמינים להשוואה בין שני הסרטונים.</InlineNotice>
      </div>
    );
  }

  const definition = metricDefinition(widest.key);
  const subjectValue = metricNumber(readMetric(subject.snapshot!.metrics, widest.key))!;
  const previousValue = metricNumber(readMetric(previous.snapshot!.metrics, widest.key))!;

  return (
    <div className="mt-4">
      <InlineNotice tone="accent">
        הפער הגדול ביותר הוא ב{definition.labelHe}:{' '}
        <span className="num font-semibold text-fg">
          {formatMetricValue(widest.key, subjectValue)}
        </span>{' '}
        מול{' '}
        <span className="num">{formatMetricValue(widest.key, previousValue)}</span>{' '}
        <span className="num">({formatSignedPercent(widest.difference)})</span>.
      </InlineNotice>
    </div>
  );
}
