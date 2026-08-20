import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { benchmarkOf } from '@/lib/analysis/video-analysis';
import { readMetric, type BenchmarkMetricKey } from '@/lib/benchmark/metrics';
import { pendingMetric } from '@/lib/domain/metric';
import { MetricCard } from '@/components/ui/metric-card';

/** The four headline metrics from design 1a, measured against the peer median. */
const KPI_METRICS: readonly BenchmarkMetricKey[] = [
  'impressionsCtr',
  'averageViewDurationSeconds',
  'subscribersPer1kViews',
  'watchTimeMinutes',
];

export function KpiStrip({ analysis }: { analysis: VideoAnalysis }) {
  return (
    <div className="grid grid-cols-1 gap-px border-b border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {KPI_METRICS.map((key) => (
        <MetricCard
          key={key}
          metricKey={key}
          metric={analysis.snapshot ? readMetric(analysis.snapshot.metrics, key) : pendingMetric()}
          benchmark={benchmarkOf(analysis, key)}
        />
      ))}
    </div>
  );
}
