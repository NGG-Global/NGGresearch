import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { buildPerformanceSeries } from '@/lib/analysis/chart';
import { analyseOne } from '@/lib/analysis/dataset-analysis';
import { readMetric } from '@/lib/benchmark/metrics';
import { loadChannelDataset, snapshotsFor } from '@/lib/data';
import { classificationSourceLabel, contentTypeLabel } from '@/lib/domain/classification';
import { pendingMetric } from '@/lib/domain/metric';
import {
  CURRENT_TARGET_LABEL_HE,
  enabledMilestones,
  milestoneLabel,
  milestoneUnavailableReason,
  selectSnapshot,
} from '@/lib/domain/snapshots';
import type { SnapshotTarget } from '@/lib/domain/types';
import { formatDuration, formatLongDate, formatVideoAge } from '@/lib/format';
import { formatMetric } from '@/lib/format/metric';
import { providerLabel, resolveInsight } from '@/lib/insights/service';
import { AppShell } from '@/components/shell/AppShell';
import { buildEvidence } from '@/components/insight/evidence';
import { VerdictHero } from '@/components/insight/VerdictHero';
import { StatusBadge } from '@/components/ui/indicators';
import { MetricTile } from '@/components/ui/metric-card';
import { MetricLabel, SectionTitle } from '@/components/ui/primitives';
import { EmptyState, InlineNotice } from '@/components/ui/states';
import { Thumbnail } from '@/components/ui/thumbnail';
import { BenchmarkBars } from '@/components/video/BenchmarkBars';
import { DetailedMetrics } from '@/components/video/DetailedMetrics';
import { PerformanceChart } from '@/components/video/PerformanceChart';
import { SnapshotSelector, type SnapshotOption } from '@/components/video/SnapshotSelector';

export const dynamic = 'force-dynamic';

const UNAVAILABLE_REASONS: Record<string, string> = {
  too_young: 'הסרטון עדיין לא הגיע לגיל הזה',
  window_open: 'חלון המדידה פתוח — הנתון ייתפס בסנכרון הבא',
  never_captured: 'לא נלכדה מדידה בגיל הזה, ואין אפשרות לשחזר אותה במדויק',
};

export default async function VideoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snapshot?: string }>;
}) {
  const [{ id }, { snapshot: requestedTarget }] = await Promise.all([params, searchParams]);
  const dataset = await loadChannelDataset();

  if (dataset.loadError) {
    return (
      <AppShell channel={dataset.channel} mode={dataset.mode} active="/videos">
        <EmptyState
          kicker="ERROR · DATA UNAVAILABLE"
          title="לא ניתן לטעון את הסרטון"
          body={dataset.loadError}
          tone="alert"
        />
      </AppShell>
    );
  }

  if (!dataset.channel) redirect('/connect');

  const video = dataset.videos.find((candidate) => candidate.id === id);
  if (!video) notFound();

  const analysis = analyseOne(dataset, video, asTarget(requestedTarget));
  const snapshots = snapshotsFor(dataset, video.id);
  const series = buildPerformanceSeries({ dataset, subject: video });

  const insight = await resolveInsight({ analysis, channelTitle: dataset.channel.title });
  const options = buildSnapshotOptions(analysis.availableTargets, analysis.ageHours);

  return (
    <AppShell channel={dataset.channel} mode={dataset.mode} active="/videos">
      <nav className="flex flex-wrap items-center gap-3 border-b border-hair bg-surface px-6 py-3.5 text-[12.5px] leading-none text-dim lg:px-8">
        <Link href="/videos" className="text-muted transition-colors hover:text-fg">
          → סרטונים
        </Link>
        <span className="text-edge-3" aria-hidden>
          /
        </span>
        <span className="bidi-isolate truncate text-fg">{video.title}</span>
        <div className="flex-1" />
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-[6px] px-3.5 py-2 text-muted ring-1 ring-inset ring-edge-2 transition-colors hover:text-fg"
        >
          פתח ב-YouTube
        </a>
      </nav>

      <header className="flex flex-col gap-6 border-b border-line px-6 py-7 lg:flex-row lg:gap-6.5 lg:px-8">
        <Thumbnail
          url={video.thumbnailUrl}
          title={video.title}
          durationSeconds={video.durationSeconds}
          muted={!video.classification.benchmarkEligible}
          className="w-full flex-none rounded-[9px] ring-1 ring-inset ring-line-strong lg:w-[284px]"
          sizes="(max-width: 1024px) 100vw, 284px"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <MetricLabel className="tracking-[0.1em] text-accent-soft">
              {contentTypeLabel(video.classification.contentType)}
            </MetricLabel>
            <span className="text-edge-3" aria-hidden>
              ·
            </span>
            <span className="text-[11.5px] leading-none text-dim-2">
              פורסם {formatLongDate(video.publishedAt)}
              {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)} דקות` : ''}
              {` · לפני ${formatVideoAge(analysis.ageHours)}`}
            </span>
            <StatusBadge status={analysis.score.status} />
            {analysis.score.score !== null ? (
              <span className="num text-[11.5px] leading-none text-dim">
                ציון {analysis.score.score}/100
              </span>
            ) : null}
          </div>

          <h1 className="bidi-isolate mt-3 font-display text-[22px] leading-[1.35] font-semibold tracking-[-0.015em] text-fg xl:text-[25px]">
            {video.title}
          </h1>

          <div className="mt-5">
            <SnapshotSelector options={options} active={analysis.target} />
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-[9px] border border-line-soft bg-line-soft sm:grid-cols-2 xl:grid-cols-4">
            {(['impressionsCtr', 'averageViewPercentage', 'subscribersPer1kViews', 'views'] as const).map(
              (key) => (
                <MetricTile
                  key={key}
                  metricKey={key}
                  metric={analysis.snapshot ? readMetric(analysis.snapshot.metrics, key) : pendingMetric()}
                  benchmark={analysis.benchmarks[key] ?? null}
                />
              ),
            )}
          </div>

          {!video.classification.benchmarkEligible ? (
            <div className="mt-4">
              <InlineNotice>
                הסרטון סווג כ״{contentTypeLabel(video.classification.contentType)}״ (
                {classificationSourceLabel(video.classification.source)}), ולכן הוא לא מושווה מול
                סרטונים רגילים.
              </InlineNotice>
            </div>
          ) : null}
        </div>
      </header>

      <section className="hero-glow-sm border-b border-line px-6 py-6 lg:px-8">
        {insight ? (
          <>
            <VerdictHero
              insight={insight.payload}
              evidence={buildEvidence(analysis.benchmarks)}
              meta={`${analysis.target ? milestoneLabel(analysis.target) : ''} · ${
                analysis.comparison.sampleSize
              } סרטוני השוואה`}
              generatedAt={insight.generatedAt}
              providerLabel={providerLabel(insight.provider, insight.model)}
              size="md"
            />
            {analysis.dataQualityNotes.length > 0 ? (
              <ul className="mt-4 space-y-1.5">
                {analysis.dataQualityNotes.map((note) => (
                  <li key={note} className="text-[12px] leading-[1.6] text-dim">
                    · {note}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <EmptyState
            kicker="EMPTY · NO SNAPSHOT"
            title="אין עדיין נקודת מדידה לסרטון הזה"
            body="YouTube מספק אנליטיקס בעיכוב של עד 48 שעות. לאחר הסנכרון הבא תופיע כאן נקודת מדידה וניתוח."
          />
        )}
      </section>

      <div className="grid gap-px bg-line xl:grid-cols-[1.45fr_1fr]">
        <div className="bg-canvas px-6 py-6 lg:px-7">
          <SectionTitle title="ביצוע לאורך זמן" hint="צפיות מצטברות לפי יום מהפרסום" />
          {series.hasSubjectData ? (
            <div className="mt-5">
              <PerformanceChart points={series.points} peerCount={series.peerCount} />
              {!series.hasBenchmark ? (
                <p className="mt-2.5 text-[11.5px] leading-[1.6] text-dim">
                  אין מספיק סרטונים דומים עם נתונים יומיים כדי לשרטט קו השוואה.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 rounded-[8px] border border-line-strong bg-panel px-4 py-3.5 text-[13px] leading-[1.6] text-muted">
              אין עדיין נתונים יומיים לסרטון הזה.
            </p>
          )}

          <div className="mt-6 grid gap-4.5 sm:grid-cols-3">
            {enabledMilestones().map((milestone) => {
              const snapshot = selectSnapshot(snapshots, milestone.target);
              const metric = snapshot ? readMetric(snapshot.metrics, 'views') : null;
              return (
                <div
                  key={milestone.target}
                  className="rounded-[8px] border border-line-strong bg-panel px-4 py-3.5"
                >
                  <MetricLabel className="text-[9.5px]">{milestone.labelHe}</MetricLabel>
                  <div
                    className={`num mt-2.5 text-[20px] leading-none font-semibold ${
                      metric?.state === 'available' ? 'text-fg' : 'text-dim-3'
                    }`}
                  >
                    {metric ? formatMetric('views', metric) : '—'}
                  </div>
                  <p className="mt-2 text-[11px] leading-[1.4] text-dim-2">
                    {snapshot
                      ? snapshot.snapshotSource === 'milestone_capture'
                        ? 'מדידה בגיל האמיתי'
                        : 'שוחזר מנתונים יומיים'
                      : UNAVAILABLE_REASONS[
                          milestoneUnavailableReason(milestone.target, analysis.ageHours)
                        ]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-canvas px-6 py-6 lg:px-7">
          <BenchmarkBars
            benchmarks={analysis.benchmarks}
            sampleSize={analysis.comparison.sampleSize}
            hasEnoughData={analysis.comparison.hasEnoughData}
            milestoneLabelHe={analysis.target ? milestoneLabel(analysis.target) : '—'}
          />
        </div>
      </div>

      <DetailedMetrics snapshot={analysis.snapshot} />
    </AppShell>
  );
}

function asTarget(value: string | undefined): SnapshotTarget | null {
  if (!value) return null;
  const valid: SnapshotTarget[] = ['h6', 'h24', 'h72', 'd7', 'd14', 'd30', 'current'];
  return valid.includes(value as SnapshotTarget) ? (value as SnapshotTarget) : null;
}

/** Every enabled milestone is listed; unavailable ones carry their reason. */
function buildSnapshotOptions(
  available: readonly SnapshotTarget[],
  ageHours: number,
): SnapshotOption[] {
  const options: SnapshotOption[] = enabledMilestones().map((milestone) => {
    const isAvailable = available.includes(milestone.target);
    return {
      target: milestone.target,
      label: milestone.labelHe,
      available: isAvailable,
      reason: isAvailable
        ? null
        : (UNAVAILABLE_REASONS[milestoneUnavailableReason(milestone.target, ageHours)] ?? null),
    };
  });

  options.push({
    target: 'current',
    label: CURRENT_TARGET_LABEL_HE,
    available: available.includes('current'),
    reason: available.includes('current') ? null : 'אין עדיין נתוני מצב נוכחי',
  });

  return options;
}
