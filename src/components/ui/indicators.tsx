import { statusLabel, type PerformanceStatus } from '@/lib/benchmark';
import { formatSignedPercent } from '@/lib/format';
import { Figure } from './primitives';

/**
 * Trend and status indicators. Colour is always paired with an arrow or a word
 * so the signal survives for colour-blind readers and in print.
 */

export function DeltaIndicator({
  percentDifference,
  higherIsBetter = true,
  className = '',
}: {
  percentDifference: number | null;
  higherIsBetter?: boolean;
  className?: string;
}) {
  if (percentDifference === null || !Number.isFinite(percentDifference)) {
    return <span className={`text-[11px] leading-none text-dim-2 ${className}`}>אין השוואה</span>;
  }

  const good = higherIsBetter ? percentDifference >= 0 : percentDifference <= 0;
  const tone = Math.abs(percentDifference) < 1 ? 'text-dim' : good ? 'text-positive' : 'text-negative';
  const arrow = percentDifference > 0 ? '▲' : percentDifference < 0 ? '▼' : '—';

  return (
    <span className={`font-display text-[12px] leading-none font-medium ${tone} ${className}`}>
      <span aria-hidden>{arrow} </span>
      <Figure>{formatSignedPercent(Math.abs(percentDifference)).replace(/^[+-]/, '')}</Figure>
    </span>
  );
}

const STATUS_STYLES: Record<PerformanceStatus, string> = {
  exceptional: 'text-positive bg-positive/12 ring-positive/30',
  strong: 'text-positive bg-positive/8 ring-positive/20',
  typical: 'text-fg-3 bg-inset ring-edge',
  weak: 'text-negative bg-negative/10 ring-negative/25',
  insufficient_data: 'text-dim bg-inset/60 ring-edge',
};

export function StatusBadge({
  status,
  className = '',
}: {
  status: PerformanceStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-2 py-1 text-[11.5px] leading-none font-semibold ring-1 ring-inset ${STATUS_STYLES[status]} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}

/** The small dot + text used for connection and sync state in the nav. */
export function StatusDot({
  tone,
  children,
}: {
  tone: 'positive' | 'negative' | 'neutral' | 'pending';
  children: React.ReactNode;
}) {
  const colours: Record<typeof tone, string> = {
    positive: 'bg-positive',
    negative: 'bg-negative',
    neutral: 'bg-dim',
    pending: 'bg-accent-soft',
  };
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] leading-none text-dim">
      <span className={`size-1.5 rounded-full ${colours[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

export function ConfidenceChip({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const labels = { high: 'ביטחון גבוה', medium: 'ביטחון בינוני', low: 'ביטחון נמוך' } as const;
  const tones = {
    high: 'text-positive ring-positive/25',
    medium: 'text-fg-3 ring-edge-3',
    low: 'text-dim ring-edge',
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-[5px] px-2 py-1 text-[11px] leading-none ring-1 ring-inset ${tones[confidence]}`}
    >
      {labels[confidence]}
    </span>
  );
}
