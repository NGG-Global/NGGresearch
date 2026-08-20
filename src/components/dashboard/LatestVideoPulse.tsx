import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { benchmarkOf } from '@/lib/analysis/video-analysis';
import type { DailyMetric } from '@/lib/domain/types';
import { milestoneLabel } from '@/lib/domain/snapshots';
import { formatVideoAge } from '@/lib/format';
import { DeltaIndicator } from '@/components/ui/indicators';
import { MetricFigure } from '@/components/ui/metric-card';
import { MetricLabel } from '@/components/ui/primitives';
import { Sparkline, type SparkBar } from './Sparkline';

const SPARK_DAYS = 9;

/**
 * The hero-side card from design 1a, retargeted at the newest video: total
 * views at the selected milestone, the gap to the peer median, and the daily
 * shape that produced it.
 */
export function LatestVideoPulse({
  analysis,
  daily,
}: {
  analysis: VideoAnalysis;
  daily: readonly DailyMetric[];
}) {
  const views = analysis.snapshot?.metrics.views ?? null;
  const benchmark = benchmarkOf(analysis, 'views');
  const bars: SparkBar[] = [...daily]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, SPARK_DAYS)
    .map((row, index) => ({ label: `יום ${index + 1}`, value: row.views }));

  return (
    <aside className="w-full max-w-[420px] flex-none rounded-[10px] border border-line-strong bg-panel p-4.5 xl:w-[300px] xl:max-w-none">
      <div className="flex items-baseline justify-between gap-3">
        <MetricLabel className="tracking-[0.1em]">VIEWS</MetricLabel>
        <span className="text-[10.5px] leading-none text-dim-2">
          {analysis.target ? milestoneLabel(analysis.target) : formatVideoAge(analysis.ageHours)}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2.5">
        <MetricFigure metricKey="views" metric={views} />
        <DeltaIndicator
          percentDifference={benchmark?.percentDifference ?? null}
          higherIsBetter
        />
      </div>

      <Sparkline
        bars={bars}
        startLabel={bars.length > 0 ? 'D1' : ''}
        midLabel={bars.length > 4 ? `D${Math.ceil(bars.length / 2)}` : ''}
        endLabel={bars.length > 0 ? `D${bars.length}` : ''}
      />

      <p className="mt-3.5 border-t border-line pt-3 text-[11.5px] leading-[1.6] text-dim-2">
        {benchmark && benchmark.benchmark !== null
          ? `חציון ${benchmark.sampleSize} סרטונים דומים באותה נקודה`
          : 'אין עדיין בסיס השוואה בנקודה הזו'}
      </p>
    </aside>
  );
}
