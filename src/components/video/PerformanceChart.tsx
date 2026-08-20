'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PerformancePoint } from '@/lib/analysis/chart';
import { formatCompact, formatInteger } from '@/lib/format';

/**
 * Cumulative views by day of life: this video against the median of comparable
 * videos at the same point in their own lifecycle.
 *
 * RTL handling: the X axis is reversed so day 1 sits on the right, matching the
 * reading direction of the rest of the interface.
 */
export function PerformanceChart({
  points,
  peerCount,
}: {
  points: readonly PerformancePoint[];
  peerCount: number;
}) {
  const data = points.map((point) => ({
    day: point.dayIndex + 1,
    subject: point.subjectViews,
    benchmark: point.benchmarkViews,
  }));

  return (
    <div className="h-[220px] w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="#17171c" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            reversed
            tick={{ fill: '#5c5c66', fontSize: 10, fontFamily: 'var(--font-plex-mono)' }}
            tickFormatter={(value: number) => `D${value}`}
            stroke="#1e1e25"
            tickLine={false}
          />
          <YAxis
            orientation="right"
            tick={{ fill: '#5c5c66', fontSize: 10, fontFamily: 'var(--font-plex-mono)' }}
            tickFormatter={(value: number) => formatCompact(value)}
            stroke="#1e1e25"
            tickLine={false}
            width={46}
          />
          <Tooltip
            contentStyle={{
              background: '#141419',
              border: '1px solid #2e2e37',
              borderRadius: 8,
              fontSize: 12,
              direction: 'rtl',
            }}
            labelStyle={{ color: '#8a8a93' }}
            labelFormatter={(value) => `יום ${value}`}
            formatter={(value, name) => [
              typeof value === 'number' ? formatInteger(value) : 'אין נתון',
              name === 'subject' ? 'הסרטון הזה' : `חציון ${peerCount} דומים`,
            ]}
          />
          <Line
            type="monotone"
            dataKey="subject"
            stroke="#e01521"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            name="subject"
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="#33333d"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            connectNulls={false}
            name="benchmark"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
