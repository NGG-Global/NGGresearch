import { redirect } from 'next/navigation';
import { analyseAll } from '@/lib/analysis/dataset-analysis';
import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { readMetric } from '@/lib/benchmark/metrics';
import { loadChannelDataset } from '@/lib/data';
import { contentTypeLabel } from '@/lib/domain/classification';
import { pendingMetric } from '@/lib/domain/metric';
import { milestoneLabel } from '@/lib/domain/snapshots';
import { formatMetricCell } from '@/lib/format/metric';
import { metricNumber } from '@/lib/domain/metric';
import { AppShell } from '@/components/shell/AppShell';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { VideosTable, type VideoTableRow } from '@/components/video/VideosTable';

export const dynamic = 'force-dynamic';

export default async function VideosPage() {
  const dataset = await loadChannelDataset();

  if (dataset.loadError) {
    return (
      <AppShell channel={dataset.channel} mode={dataset.mode} active="/videos">
        <EmptyState
          kicker="ERROR · DATA UNAVAILABLE"
          title="לא ניתן לטעון את הסרטונים"
          body={dataset.loadError}
          tone="alert"
          action={<ButtonLink href="/settings">להגדרות</ButtonLink>}
        />
      </AppShell>
    );
  }

  if (!dataset.channel) redirect('/connect');

  const analyses = analyseAll(dataset);

  return (
    <AppShell channel={dataset.channel} mode={dataset.mode} active="/videos">
      {analyses.length === 0 ? (
        <EmptyState
          kicker="EMPTY · NO VIDEOS"
          title="אין עדיין סרטונים"
          body="לאחר הסנכרון הראשון כל הסרטונים של הערוץ יופיעו כאן."
          action={<ButtonLink href="/settings">להגדרות סנכרון</ButtonLink>}
        />
      ) : (
        <VideosTable rows={analyses.map(toRow)} />
      )}
    </AppShell>
  );
}

/** Formats one analysis into the serializable shape the table renders. */
function toRow(analysis: VideoAnalysis): VideoTableRow {
  const { video, snapshot } = analysis;
  const metrics = snapshot?.metrics;
  const read = (key: Parameters<typeof readMetric>[1]) =>
    metrics ? readMetric(metrics, key) : pendingMetric();

  const views = read('views');
  const retention = read('averageViewPercentage');
  const ctr = read('impressionsCtr');
  const subscribers = read('subscribersGained');

  return {
    id: video.id,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    ageHours: analysis.ageHours,
    durationSeconds: video.durationSeconds,
    contentTypeLabel: contentTypeLabel(video.classification.contentType),
    benchmarkEligible: video.classification.benchmarkEligible,
    targetLabel: analysis.target ? milestoneLabel(analysis.target) : null,
    views: formatMetricCell('views', views),
    viewsValue: metricNumber(views),
    watchTime: formatMetricCell('watchTimeMinutes', read('watchTimeMinutes')),
    retention: formatMetricCell('averageViewPercentage', retention),
    retentionValue: metricNumber(retention),
    ctr: formatMetricCell('impressionsCtr', ctr),
    ctrValue: metricNumber(ctr),
    subscribers: formatMetricCell('subscribersGained', subscribers),
    subscribersValue: metricNumber(subscribers),
    status: analysis.score.status,
    scoreValue: analysis.score.score,
  };
}
