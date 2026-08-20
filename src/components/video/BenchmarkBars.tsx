import type { MetricBenchmark } from '@/lib/benchmark';
import { metricDefinition, type BenchmarkMetricKey } from '@/lib/benchmark';
import { INSUFFICIENT_BENCHMARK_MESSAGE_HE } from '@/lib/benchmark';
import { formatSignedPercent } from '@/lib/format';
import { formatMetricValue } from '@/lib/format/metric';
import { SectionTitle } from '@/components/ui/primitives';

const BAR_METRICS: readonly BenchmarkMetricKey[] = [
  'impressionsCtr',
  'averageViewPercentage',
  'subscribersPer1kViews',
  'views',
];

/**
 * "מול הביצוע הטיפוסי" — the paired-bar comparison from design 1c, retargeted
 * from "the previous video" to the median of comparable videos, which is the
 * benchmark the product is built on.
 */
export function BenchmarkBars({
  benchmarks,
  sampleSize,
  hasEnoughData,
  milestoneLabelHe,
}: {
  benchmarks: Readonly<Record<string, MetricBenchmark>>;
  sampleSize: number;
  hasEnoughData: boolean;
  milestoneLabelHe: string;
}) {
  return (
    <section>
      <SectionTitle title="מול הביצוע הטיפוסי" />
      <p className="mt-1.5 text-[11.5px] leading-[1.5] text-dim-2">
        {hasEnoughData
          ? `חציון ${sampleSize} סרטונים דומים בנקודת ${milestoneLabelHe}`
          : INSUFFICIENT_BENCHMARK_MESSAGE_HE}
      </p>

      <div className="mt-5 grid gap-4.5">
        {BAR_METRICS.map((key) => {
          const benchmark = benchmarks[key];
          if (!benchmark) return null;
          return <BenchmarkRow key={key} metricKey={key} benchmark={benchmark} />;
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3.5 border-t border-line pt-4 text-[11.5px] leading-none text-dim-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-accent" aria-hidden />
          הסרטון הזה
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-bar-high" aria-hidden />
          חציון דומים
        </span>
      </div>
    </section>
  );
}

function BenchmarkRow({
  metricKey,
  benchmark,
}: {
  metricKey: BenchmarkMetricKey;
  benchmark: MetricBenchmark;
}) {
  const definition = metricDefinition(metricKey);
  const { value, benchmark: median } = benchmark;

  // Both bars share one scale so their lengths are directly comparable. The
  // headroom keeps the larger bar short of the full track, so a bar that is
  // simply "the biggest of the two" still reads as a measured length.
  const HEADROOM = 0.85;
  const largest = Math.max(value ?? 0, median ?? 0);
  const scale = largest > 0 ? largest / HEADROOM : 1;
  const subjectWidth = value !== null ? Math.max(2, Math.min(100, (value / scale) * 100)) : 0;
  const medianWidth = median !== null ? Math.max(2, Math.min(100, (median / scale) * 100)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[12px] leading-none">
        <span className="text-fg-3">{definition.labelHe}</span>
        <span>
          <span className="num font-semibold text-fg">
            {value !== null ? formatMetricValue(metricKey, value) : '—'}
          </span>
          <span className="num text-dim-2">
            {' / '}
            {median !== null ? formatMetricValue(metricKey, median) : '—'}
          </span>
          {benchmark.percentDifference !== null ? (
            <span
              className={`num ms-2 ${
                benchmark.percentDifference >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {formatSignedPercent(benchmark.percentDifference)}
            </span>
          ) : null}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-[3px] bg-inset">
        <div className="h-full bg-accent" style={{ width: `${subjectWidth}%` }} />
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-inset">
        <div className="h-full bg-bar-high" style={{ width: `${medianWidth}%` }} />
      </div>

      {value === null ? (
        <p className="mt-1.5 text-[11px] leading-none text-dim">
          {benchmark.metricState === 'pending' ? 'הנתון עדיין לא הגיע מ-YouTube' : 'הנתון אינו זמין'}
        </p>
      ) : null}
    </div>
  );
}
