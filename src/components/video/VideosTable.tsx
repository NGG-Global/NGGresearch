'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { PerformanceStatus } from '@/lib/benchmark';
import type { MetricCell } from '@/lib/format/metric';
import { formatDuration, formatShortDate, formatVideoAge } from '@/lib/format';
import { StatusBadge } from '@/components/ui/indicators';
import { MetricLabel } from '@/components/ui/primitives';
import { Thumbnail } from '@/components/ui/thumbnail';
import { EmptyState } from '@/components/ui/states';

/**
 * Serializable row prepared on the server, so this client component holds no
 * analytics logic — only search, sort and date filtering.
 */
export interface VideoTableRow {
  readonly id: string;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly publishedAt: string;
  readonly ageHours: number;
  readonly durationSeconds: number | null;
  readonly contentTypeLabel: string;
  readonly benchmarkEligible: boolean;
  readonly targetLabel: string | null;
  readonly views: MetricCell;
  readonly viewsValue: number | null;
  readonly watchTime: MetricCell;
  readonly retention: MetricCell;
  readonly retentionValue: number | null;
  readonly ctr: MetricCell;
  readonly ctrValue: number | null;
  readonly subscribers: MetricCell;
  readonly subscribersValue: number | null;
  readonly status: PerformanceStatus;
  readonly scoreValue: number | null;
}

type SortKey = 'newest' | 'views' | 'retention' | 'subscribers' | 'performance';

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'newest', label: 'החדשים' },
  { key: 'views', label: 'צפיות' },
  { key: 'retention', label: 'אחוז צפייה' },
  { key: 'subscribers', label: 'מנויים' },
  { key: 'performance', label: 'ביצוע' },
];

type RangeKey = '28d' | '90d' | '365d' | 'all';

const RANGES: ReadonlyArray<{ key: RangeKey; label: string; days: number | null }> = [
  { key: '28d', label: '28 ימים', days: 28 },
  { key: '90d', label: '90 ימים', days: 90 },
  { key: '365d', label: 'שנה', days: 365 },
  { key: 'all', label: 'הכול', days: null },
];

const GRID =
  'grid grid-cols-[minmax(0,2.6fr)_0.85fr_0.6fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr_1fr] items-center';

export function VideosTable({ rows }: { rows: readonly VideoTableRow[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [range, setRange] = useState<RangeKey>('90d');
  const [limit, setLimit] = useState(15);

  const filtered = useMemo(() => {
    const rangeDays = RANGES.find((entry) => entry.key === range)?.days ?? null;
    const needle = query.trim().toLowerCase();

    const matched = rows.filter((row) => {
      if (rangeDays !== null && row.ageHours > rangeDays * 24) return false;
      if (needle.length > 0 && !row.title.toLowerCase().includes(needle)) return false;
      return true;
    });

    return [...matched].sort((a, b) => {
      switch (sort) {
        case 'views':
          return nullsLast(b.viewsValue, a.viewsValue);
        case 'retention':
          return nullsLast(b.retentionValue, a.retentionValue);
        case 'subscribers':
          return nullsLast(b.subscribersValue, a.subscribersValue);
        case 'performance':
          return nullsLast(b.scoreValue, a.scoreValue);
        case 'newest':
        default:
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
    });
  }, [rows, query, sort, range]);

  const visible = filtered.slice(0, limit);

  return (
    <>
      <div className="flex flex-wrap items-end gap-3.5 px-6 pt-5 pb-4 lg:px-8">
        <div>
          <div className="font-display text-[20px] leading-[1.2] font-semibold text-fg">
            <span className="num">{filtered.length}</span> סרטונים
          </div>
          <div className="mt-1.5 text-[12px] leading-[1.4] text-dim-2">בטווח שנבחר</div>
        </div>

        <div className="flex-1" />

        <label className="w-full sm:w-[250px]">
          <span className="sr-only">חיפוש בכותרות</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש בכותרות…"
            className="w-full rounded-[7px] bg-panel px-3.5 py-2.5 text-[12.5px] leading-none text-fg ring-1 ring-inset ring-edge outline-none transition-colors placeholder:text-dim-2 focus:ring-edge-3"
          />
        </label>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="טווח תאריכים">
          {RANGES.map((entry) => (
            <Chip
              key={entry.key}
              active={range === entry.key}
              onClick={() => setRange(entry.key)}
              label={entry.label}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="מיון">
          {SORTS.map((entry) => (
            <Chip
              key={entry.key}
              active={sort === entry.key}
              onClick={() => setSort(entry.key)}
              label={entry.label}
            />
          ))}
        </div>
      </div>

      <div className="mx-6 mb-8 overflow-hidden rounded-[10px] border border-line-soft lg:mx-8">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className={`${GRID} border-b border-line-soft bg-panel`}>
              <HeaderCell>VIDEO</HeaderCell>
              <HeaderCell>PUBLISHED</HeaderCell>
              <HeaderCell>AGE</HeaderCell>
              <HeaderCell active={sort === 'views'}>VIEWS</HeaderCell>
              <HeaderCell>WATCH TIME</HeaderCell>
              <HeaderCell active={sort === 'retention'}>RETENTION</HeaderCell>
              <HeaderCell>CTR</HeaderCell>
              <HeaderCell active={sort === 'subscribers'}>SUBS</HeaderCell>
              <HeaderCell active={sort === 'performance'}>STATUS</HeaderCell>
            </div>

            {visible.length === 0 ? (
              <EmptyState
                kicker="EMPTY · NO MATCHES"
                title="אין סרטונים בטווח הזה"
                body="אפשר להרחיב את טווח התאריכים או לנקות את החיפוש."
              />
            ) : (
              visible.map((row) => (
                <Link
                  key={row.id}
                  href={`/videos/${row.id}`}
                  className={`${GRID} border-b border-inset bg-panel-alt transition-colors last:border-b-0 hover:bg-panel`}
                >
                  <div className="flex min-w-0 items-center gap-3 px-2.5 py-3.5 ps-5">
                    <Thumbnail
                      url={row.thumbnailUrl}
                      title={row.title}
                      durationSeconds={row.durationSeconds}
                      showDuration={false}
                      showLabel={false}
                      muted={!row.benchmarkEligible}
                      className="w-16 shrink-0 rounded-[4px]"
                      sizes="64px"
                    />
                    <div className="min-w-0">
                      <div className="bidi-isolate truncate font-display text-[13.5px] leading-[1.3] font-semibold text-fg">
                        {row.title}
                      </div>
                      <div className="metric-label mt-1.5 truncate text-[10.5px] tracking-[0.04em] text-dim">
                        {row.contentTypeLabel}
                        {row.durationSeconds ? ` · ${formatDuration(row.durationSeconds)}` : ''}
                      </div>
                    </div>
                  </div>

                  <Cell className="text-muted-2">{formatShortDate(row.publishedAt)}</Cell>
                  <Cell className="text-dim">{formatVideoAge(row.ageHours)}</Cell>
                  <MetricCellView cell={row.views} className="font-semibold text-fg" />
                  <MetricCellView cell={row.watchTime} />
                  <MetricCellView cell={row.retention} />
                  <MetricCellView cell={row.ctr} />
                  <MetricCellView cell={row.subscribers} />

                  <div className="px-2.5 py-3.5">
                    <StatusBadge status={row.status} />
                    {row.targetLabel ? (
                      <div className="metric-label mt-1.5 text-[9.5px] text-dim-2">
                        {row.targetLabel}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))
            )}

            <div className="flex items-center gap-3 bg-surface px-5 py-3.5 text-[12px] leading-none text-dim-2">
              <span className="num">
                {visible.length > 0 ? `1–${visible.length}` : '0'} מתוך {filtered.length}
              </span>
              <div className="flex-1" />
              {visible.length < filtered.length ? (
                <button
                  type="button"
                  onClick={() => setLimit((value) => value + 15)}
                  className="text-muted transition-colors hover:text-fg"
                >
                  הצג עוד
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function HeaderCell({ children, active = false }: { children: string; active?: boolean }) {
  return (
    <div className="px-2.5 py-3.5 first:ps-5">
      <MetricLabel className={active ? 'text-fg' : undefined}>{children}</MetricLabel>
    </div>
  );
}

function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`num px-2.5 py-3.5 text-[13.5px] leading-none ${className}`}>{children}</div>;
}

/** Absent values collapse to an em dash so rows keep one line height. */
function MetricCellView({ cell, className = 'text-fg-3' }: { cell: MetricCell; className?: string }) {
  return (
    <div
      className={`num truncate px-2.5 py-3.5 text-[13.5px] leading-none ${
        cell.note ? 'text-dim-3' : className
      }`}
      title={cell.note ?? undefined}
    >
      {cell.text}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-[7px] bg-chip-strong px-3.5 py-2.5 text-[12px] leading-none font-semibold text-fg'
          : 'rounded-[7px] px-3.5 py-2.5 text-[12px] leading-none text-muted ring-1 ring-inset ring-edge transition-colors hover:text-fg'
      }
    >
      {label}
    </button>
  );
}

/** Sorts missing values to the bottom regardless of direction. */
function nullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
