import type { AnalyticsSnapshot } from '@/lib/domain/types';
import { readMetric, type BenchmarkMetricKey } from '@/lib/benchmark/metrics';
import { metricDefinition } from '@/lib/benchmark';
import { formatMetric } from '@/lib/format/metric';
import { MetricLabel, SectionTitle } from '@/components/ui/primitives';

interface MetricGroup {
  readonly title: string;
  readonly latinTitle: string;
  readonly metrics: readonly BenchmarkMetricKey[];
}

/** Metric groups from the V1 spec: reach, engagement, conversion, interaction. */
const GROUPS: readonly MetricGroup[] = [
  { title: 'חשיפה', latinTitle: 'REACH', metrics: ['impressions', 'impressionsCtr', 'views'] },
  {
    title: 'צפייה',
    latinTitle: 'ENGAGEMENT',
    metrics: ['watchTimeMinutes', 'averageViewDurationSeconds', 'averageViewPercentage'],
  },
  { title: 'המרה', latinTitle: 'CONVERSION', metrics: ['subscribersGained', 'subscribersLost'] },
  { title: 'אינטראקציה', latinTitle: 'INTERACTION', metrics: ['likes', 'comments'] },
];

export function DetailedMetrics({ snapshot }: { snapshot: AnalyticsSnapshot | null }) {
  return (
    <section className="border-t border-line px-6 py-6 lg:px-8">
      <SectionTitle title="מדדים מפורטים" hint="בנקודת המדידה שנבחרה" />

      <div className="mt-5 grid gap-px overflow-hidden rounded-[9px] border border-line-soft bg-line-soft md:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((group) => (
          <div key={group.latinTitle} className="bg-panel-alt px-5 py-4.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-display text-[13px] leading-none font-semibold text-fg">
                {group.title}
              </h3>
              <MetricLabel className="text-[9.5px]">{group.latinTitle}</MetricLabel>
            </div>

            <dl className="mt-4 grid gap-3.5">
              {group.metrics.map((key) => {
                const metric = snapshot ? readMetric(snapshot.metrics, key) : null;
                const unknown = !metric || metric.state !== 'available';
                return (
                  <div key={key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12.5px] leading-none text-muted">
                      {metricDefinition(key).labelHe}
                    </dt>
                    <dd
                      className={`num text-[14px] leading-none font-semibold ${
                        unknown ? 'text-dim-3' : 'text-fg'
                      }`}
                      title={unknown ? (metric?.note ?? 'לא זמין') : undefined}
                    >
                      {metric ? formatMetric(key, metric) : '—'}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-3.5 text-[11.5px] leading-[1.6] text-dim">
        מדד שמופיע כ״—״ אינו אפס: הנתון פשוט לא זמין או טרם הגיע מ-YouTube.
      </p>
    </section>
  );
}
