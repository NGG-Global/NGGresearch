import { MetricLabel } from '@/components/ui/primitives';

export interface SparkBar {
  readonly label: string;
  readonly value: number;
}

/**
 * The daily bar sparkline from the design's hero card. Bars warm towards the
 * accent colour as they approach the present, so the newest day reads first.
 */
export function Sparkline({
  bars,
  startLabel,
  midLabel,
  endLabel,
}: {
  bars: readonly SparkBar[];
  startLabel: string;
  midLabel: string;
  endLabel: string;
}) {
  const max = bars.reduce((highest, bar) => Math.max(highest, bar.value), 0);

  if (bars.length === 0 || max <= 0) {
    return (
      <div className="mt-4 flex h-[76px] items-center justify-center rounded-[6px] bg-inset/60 text-[11.5px] text-dim-2">
        אין עדיין נתונים יומיים
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 h-[76px]">
        <div className="flex h-full items-end gap-1" role="img" aria-label="צפיות לפי יום">
          {bars.map((bar, index) => {
            const fromEnd = bars.length - 1 - index;
            const height = Math.max(4, Math.round((bar.value / max) * 100));
            return (
              <div
                key={bar.label}
                title={`${bar.label}: ${bar.value.toLocaleString('he-IL')}`}
                className={`flex-1 rounded-t-[2px] ${barTone(fromEnd)}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-2.5 flex justify-between">
        <MetricLabel className="text-[10px] tracking-normal text-dim-2">{startLabel}</MetricLabel>
        <MetricLabel className="text-[10px] tracking-normal text-dim-2">{midLabel}</MetricLabel>
        <MetricLabel className="text-[10px] tracking-normal text-dim-2">{endLabel}</MetricLabel>
      </div>
    </>
  );
}

function barTone(fromEnd: number): string {
  if (fromEnd === 0) return 'bg-accent shadow-[0_0_12px_rgba(224,21,33,0.45)]';
  if (fromEnd === 1) return 'bg-accent-ember';
  if (fromEnd <= 3) return 'bg-bar-high';
  if (fromEnd <= 5) return 'bg-bar-mid';
  return 'bg-bar-low';
}
