'use client';

import { useState } from 'react';
import type { InsightPayload } from '@/lib/domain/types';
import { formatRelativeAge } from '@/lib/format';
import { ConfidenceChip } from '@/components/ui/indicators';
import { MetricLabel } from '@/components/ui/primitives';
import type { EvidenceItem } from './evidence';

/**
 * The AI verdict hero from design 1a/1c: a single sentence that answers "how is
 * this video doing", with the measured evidence one click away.
 */
export function VerdictHero({
  insight,
  evidence,
  meta,
  generatedAt,
  providerLabel,
  size = 'lg',
  defaultOpen = true,
}: {
  insight: InsightPayload;
  evidence: readonly EvidenceItem[];
  meta: string;
  generatedAt: string;
  providerLabel: string;
  size?: 'lg' | 'md';
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className="size-[5px] rounded-full bg-accent shadow-[0_0_8px_#e01521]"
          aria-hidden
        />
        <MetricLabel className="text-[10.5px] tracking-[0.14em] text-accent-soft">
          AI VERDICT
        </MetricLabel>
        <span className="text-[11px] leading-none text-dim-2">{meta}</span>
        <ConfidenceChip confidence={insight.confidence} />
      </div>

      <p
        className={`mt-4 max-w-[820px] font-display font-semibold tracking-[-0.015em] text-fg text-pretty ${
          size === 'lg' ? 'text-[26px] leading-[1.42] xl:text-[33px]' : 'text-[22px] leading-[1.42] xl:text-[27px]'
        }`}
      >
        {insight.summary}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-[7px] bg-accent px-4 py-2.5 text-[13px] leading-none font-semibold text-white shadow-[0_4px_14px_rgba(224,21,33,0.3)] transition-colors hover:bg-accent/90"
        >
          למה?
          <span className="text-[10px] opacity-85" aria-hidden>
            {open ? '▴' : '▾'}
          </span>
        </button>
        <span className="text-[12px] leading-none text-dim">
          {evidence.length} ראיות · עודכן {formatRelativeAge(generatedAt)} · {providerLabel}
        </span>
      </div>

      {open ? (
        <div className="mt-5 overflow-hidden rounded-[10px] border border-line-strong bg-panel-deep">
          <div className="flex items-center gap-2.5 border-b border-line-soft bg-panel-head px-4.5 py-3">
            <MetricLabel className="tracking-[0.12em] text-muted-2">EVIDENCE</MetricLabel>
            <span className="text-[11.5px] leading-none text-dim-2">מה הוביל לוורדיקט</span>
          </div>

          <div className="grid gap-px bg-line-soft md:grid-cols-2">
            {evidence.map((item) => (
              <div key={item.label} className="bg-panel-deep px-4.5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <MetricLabel className="tracking-[0.08em]">{item.label}</MetricLabel>
                  <span className="num text-[14px] leading-none font-semibold text-fg">
                    {item.value}
                    {item.reference ? (
                      <span className="font-normal text-dim-2"> / {item.reference}</span>
                    ) : null}
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] leading-[1.6] text-muted">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-px border-t border-line-soft bg-line-soft md:grid-cols-2">
            <div className="bg-panel-deep px-4.5 py-4">
              <MetricLabel className="tracking-[0.08em]">MAIN SIGNAL</MetricLabel>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-fg-3">{insight.mainSignal}</p>
            </div>
            <div className="border-s-0 border-e-2 border-e-accent bg-panel-deep px-4.5 py-4">
              <MetricLabel className="tracking-[0.08em]">RECOMMENDATION</MetricLabel>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-fg-3">{insight.recommendation}</p>
            </div>
          </div>

          {insight.strengths.length > 0 || insight.weaknesses.length > 0 ? (
            <div className="grid gap-px border-t border-line-soft bg-line-soft md:grid-cols-2">
              <InsightList title="חוזקות" items={insight.strengths} tone="positive" />
              <InsightList title="חולשות" items={insight.weaknesses} tone="negative" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InsightList({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: 'positive' | 'negative';
}) {
  return (
    <div className="bg-panel-deep px-4.5 py-4">
      <MetricLabel className="tracking-[0.08em]">{title}</MetricLabel>
      {items.length === 0 ? (
        <p className="mt-2.5 text-[13px] leading-[1.6] text-dim-2">לא זוהו.</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-[13px] leading-[1.6] text-muted">
              <span
                className={`mt-2 size-1.5 shrink-0 rounded-full ${
                  tone === 'positive' ? 'bg-positive' : 'bg-negative'
                }`}
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
