import type { MetricBenchmark } from '@/lib/benchmark';
import { metricDefinition, type BenchmarkMetricKey } from '@/lib/benchmark';
import type { MetricValue } from '@/lib/domain/metric';
import { formatMetricValue } from '@/lib/format/metric';
import { DeltaIndicator } from './indicators';
import { MetricLabel } from './primitives';

/**
 * A metric is rendered from its state, never from a bare number:
 * pending and unavailable show an em dash plus the reason, so a missing value
 * can never be mistaken for a zero.
 */
export function MetricFigure({
  metricKey,
  metric,
  size = 'lg',
}: {
  metricKey: BenchmarkMetricKey;
  metric: MetricValue | null;
  size?: 'lg' | 'md' | 'sm';
}) {
  const classes = {
    lg: 'text-[30px] tracking-[-0.02em]',
    md: 'text-[24px] tracking-[-0.02em]',
    sm: 'text-[14px]',
  }[size];

  if (!metric || metric.state !== 'available' || metric.value === null) {
    return (
      <span className={`num font-semibold leading-none text-dim-3 ${classes}`} title={metric?.note}>
        —
      </span>
    );
  }

  return (
    <span className={`num font-semibold leading-none text-fg ${classes}`}>
      {formatMetricValue(metricKey, metric.value)}
    </span>
  );
}

/** Explanation shown under a metric that has no value. */
export function MetricStateNote({ metric }: { metric: MetricValue | null }) {
  if (!metric || metric.state === 'available') return null;
  return (
    <span className="text-[11.5px] leading-none text-dim-2">
      {metric.note ?? (metric.state === 'pending' ? 'ממתין לנתונים' : 'לא זמין')}
    </span>
  );
}

export interface MetricCardProps {
  metricKey: BenchmarkMetricKey;
  metric: MetricValue | null;
  benchmark?: MetricBenchmark | null;
  /** Overrides the default "חציון הסרטונים הדומים" subline. */
  subline?: string;
  label?: string;
}

/** The KPI strip card from the dashboard (design 1a). */
export function MetricCard({ metricKey, metric, benchmark, subline, label }: MetricCardProps) {
  const definition = metricDefinition(metricKey);
  return (
    <div className="bg-canvas px-6 py-5">
      <MetricLabel>{label ?? definition.label}</MetricLabel>
      <div className="mt-2.5 flex items-baseline gap-2.5">
        <MetricFigure metricKey={metricKey} metric={metric} />
        {benchmark ? (
          <DeltaIndicator
            percentDifference={benchmark.percentDifference}
            higherIsBetter={benchmark.higherIsBetter}
          />
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11.5px] leading-none text-dim-2">
        {subline ?? defaultSubline(metricKey, benchmark) ?? <MetricStateNote metric={metric} />}
      </div>
    </div>
  );
}

/** The compact tile used in the video detail header (design 1c). */
export function MetricTile({
  metricKey,
  metric,
  benchmark,
  label,
}: MetricCardProps) {
  const definition = metricDefinition(metricKey);
  return (
    <div className="bg-panel px-4 py-4">
      <MetricLabel className="text-[9.5px]">{label ?? definition.label}</MetricLabel>
      <div className="mt-2 flex items-baseline gap-2">
        <MetricFigure metricKey={metricKey} metric={metric} size="md" />
        {benchmark ? (
          <DeltaIndicator
            percentDifference={benchmark.percentDifference}
            higherIsBetter={benchmark.higherIsBetter}
          />
        ) : null}
      </div>
      <div className="mt-2 text-[11px] leading-none text-dim-2">
        {defaultSubline(metricKey, benchmark) ?? <MetricStateNote metric={metric} />}
      </div>
    </div>
  );
}

function defaultSubline(
  metricKey: BenchmarkMetricKey,
  benchmark: MetricBenchmark | null | undefined,
): string | null {
  if (!benchmark || benchmark.benchmark === null) return null;
  return `חציון דומים ${formatMetricValue(metricKey, benchmark.benchmark)}`;
}
