import { redirect } from 'next/navigation';
import { buildDashboardView } from '@/lib/analysis/dataset-analysis';
import { dailyFor, loadChannelDataset } from '@/lib/data';
import { formatVideoAge } from '@/lib/format';
import { milestoneLabel } from '@/lib/domain/snapshots';
import { providerLabel, resolveInsight } from '@/lib/insights/service';
import { AppShell } from '@/components/shell/AppShell';
import { AttentionCard } from '@/components/dashboard/AttentionCard';
import { HeadToHead } from '@/components/dashboard/HeadToHead';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { LatestVideoPulse } from '@/components/dashboard/LatestVideoPulse';
import { RecentVideos } from '@/components/dashboard/RecentVideos';
import { buildEvidence } from '@/components/insight/evidence';
import { VerdictHero } from '@/components/insight/VerdictHero';
import { EmptyState } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const dataset = await loadChannelDataset();

  if (dataset.loadError) {
    return (
      <AppShell channel={dataset.channel} mode={dataset.mode} active="/">
        <EmptyState
          kicker="ERROR · DATA UNAVAILABLE"
          title="לא ניתן לטעון את הנתונים"
          body={dataset.loadError}
          tone="alert"
          action={<ButtonLink href="/settings" variant="outline">להגדרות</ButtonLink>}
        />
      </AppShell>
    );
  }

  if (!dataset.channel) redirect('/connect');

  const view = buildDashboardView(dataset);

  if (!view.latest) {
    return (
      <AppShell channel={dataset.channel} mode={dataset.mode} active="/">
        <EmptyState
          kicker="EMPTY · NO DATA YET"
          title="עדיין אוספים נתונים"
          body="YouTube מספק אנליטיקס בעיכוב של עד 48 שעות. הסרטונים יופיעו כאן לאחר הסנכרון הראשון."
          action={<ButtonLink href="/settings" variant="outline">להגדרות סנכרון</ButtonLink>}
        />
      </AppShell>
    );
  }

  const latest = view.latest;
  const insight = await resolveInsight({
    analysis: latest,
    channelTitle: dataset.channel.title,
  });

  const previous =
    view.allAnalyses.find(
      (candidate) =>
        candidate.video.id !== latest.video.id &&
        candidate.video.classification.benchmarkEligible &&
        candidate.video.classification.contentType === latest.video.classification.contentType &&
        new Date(candidate.video.publishedAt).getTime() <
          new Date(latest.video.publishedAt).getTime(),
    ) ?? null;

  const heroMeta = [
    latest.target ? milestoneLabel(latest.target) : formatVideoAge(latest.ageHours),
    `${latest.comparison.sampleSize} סרטוני השוואה`,
  ].join(' · ');

  return (
    <AppShell channel={dataset.channel} mode={dataset.mode} active="/">
      <section className="hero-glow border-b border-line px-6 py-7 lg:px-8">
        {insight ? (
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1">
              <VerdictHero
                insight={insight.payload}
                evidence={buildEvidence(latest.benchmarks)}
                meta={heroMeta}
                generatedAt={insight.generatedAt}
                providerLabel={providerLabel(insight.provider, insight.model)}
              />
              {insight.degraded ? (
                <p className="mt-4 text-[12px] leading-[1.6] text-accent-soft">
                  התובנה לא נוצרה על ידי המודל הפעם. המדדים מעודכנים והניתוח הדטרמיניסטי מוצג במקום.
                </p>
              ) : null}
              {latest.dataQualityNotes.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {latest.dataQualityNotes.map((note) => (
                    <li key={note} className="text-[12px] leading-[1.6] text-dim">
                      · {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <LatestVideoPulse analysis={latest} daily={dailyFor(dataset, latest.video.id)} />
          </div>
        ) : (
          <EmptyState
            kicker="EMPTY · VIDEO TOO NEW"
            title="הסרטון חדש מדי לניתוח"
            body={`"${latest.video.title}" פורסם לפני ${formatVideoAge(
              latest.ageHours,
            )}. YouTube מספק אנליטיקס בעיכוב של עד 48 שעות, ולכן אין עדיין נקודת מדידה להשוואה.`}
          />
        )}
      </section>

      <KpiStrip analysis={latest} />

      <div className="grid gap-px bg-line xl:grid-cols-[1.22fr_1fr]">
        <div className="bg-canvas px-6 py-6 lg:px-7">
          <HeadToHead subject={latest} previous={previous} />
        </div>
        <div className="bg-canvas px-6 py-6 lg:px-7">
          <RecentVideos analyses={view.recent} />
          <div className="mt-6 border-t border-line pt-6">
            <AttentionCard signals={view.attention} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
