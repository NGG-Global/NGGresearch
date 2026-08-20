import { describe, expect, it, vi } from 'vitest';
import { analyseVideo } from '@/lib/analysis/video-analysis';
import { INSUFFICIENT_BENCHMARK_MESSAGE_HE } from '@/lib/benchmark';
import { buildInsightFacts } from '@/lib/insights/facts';
import { generateInsight, generateRulesInsight, rulesProvider } from '@/lib/insights/engine';
import { validateInsightPayload } from '@/lib/insights/schema';
import type { InsightProviderAdapter } from '@/lib/insights/provider';
import { makePeers, makeSnapshot, makeVideo, NOW } from './fixtures';

function analysisWith(params: {
  views: number | null;
  peers: readonly number[];
  ctr?: number | null;
  retention?: number | null;
  subs?: number | null;
}) {
  const video = makeVideo({ id: 'subject', publishedDaysAgo: 3, title: 'SCP-049 — רופא המגפה' });
  const snapshot = makeSnapshot({
    videoId: 'subject',
    target: 'h72',
    ageHours: 73,
    metrics: {
      views: params.views,
      impressionsCtr: params.ctr ?? null,
      averageViewPercentage: params.retention ?? null,
      subscribersGained: params.subs ?? null,
      watchTimeMinutes: params.views !== null ? params.views * 4 : null,
    },
  });

  return analyseVideo({
    video,
    snapshots: [snapshot],
    candidates: [{ video, snapshots: [snapshot] }, ...makePeers(params.peers)],
    target: 'h72',
    now: NOW,
  });
}

describe('validateInsightPayload', () => {
  it('accepts a well-formed payload', () => {
    const result = validateInsightPayload({
      summary: 'הסרטון מקבל פחות חשיפות מהרגיל, אבל הצופים נשארים זמן רב מהממוצע.',
      mainSignal: 'CTR נמוך מהחציון',
      strengths: ['אחוז צפייה גבוה'],
      weaknesses: ['CTR נמוך'],
      recommendation: 'כדאי לבדוק את האריזה בסרטון הבא.',
      confidence: 'medium',
    });
    expect(result.ok).toBe(true);
    expect(result.payload?.confidence).toBe('medium');
  });

  it('rejects an unknown confidence value', () => {
    const result = validateInsightPayload({
      summary: 'משפט תקין לגמרי כאן',
      mainSignal: 'אות',
      strengths: [],
      weaknesses: [],
      recommendation: 'המלצה',
      confidence: 'very-high',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('confidence');
  });

  it('rejects a missing field', () => {
    const result = validateInsightPayload({ summary: 'חסרים שדות אחרים' });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(validateInsightPayload(null).ok).toBe(false);
    expect(validateInsightPayload('{"summary":"x"}').ok).toBe(false);
  });

  it('rejects strings that overflow the display budget', () => {
    const result = validateInsightPayload({
      summary: 'א'.repeat(500),
      mainSignal: 'אות',
      strengths: [],
      weaknesses: [],
      recommendation: 'המלצה',
      confidence: 'low',
    });
    expect(result.ok).toBe(false);
  });

  it('caps list lengths', () => {
    const result = validateInsightPayload({
      summary: 'משפט תקין לגמרי כאן',
      mainSignal: 'אות',
      strengths: ['א1', 'א2', 'א3', 'א4', 'א5'],
      weaknesses: [],
      recommendation: 'המלצה',
      confidence: 'low',
    });
    expect(result.ok).toBe(false);
  });
});

describe('rules insight', () => {
  it('states plainly when the benchmark sample is too small', () => {
    const analysis = analysisWith({ views: 620, peers: [400, 450] });
    const facts = buildInsightFacts(analysis, 'לילה לבן');
    const insight = generateRulesInsight(facts);

    expect(insight.summary).toBe(INSUFFICIENT_BENCHMARK_MESSAGE_HE);
    expect(insight.confidence).toBe('low');
    expect(insight.strengths).toHaveLength(0);
    expect(insight.weaknesses).toHaveLength(0);
  });

  it('grounds every claim in a measured comparison', () => {
    const analysis = analysisWith({
      views: 900,
      peers: [400, 450, 470, 480, 500],
      ctr: 8.2,
      retention: 51,
      subs: 40,
    });
    const insight = generateRulesInsight(buildInsightFacts(analysis, 'לילה לבן'));

    expect(insight.strengths.length).toBeGreaterThan(0);
    // Each strength cites a value and the median it was compared against.
    for (const strength of insight.strengths) {
      expect(strength).toContain('חציון');
    }
    expect(insight.mainSignal).toContain('חציון');
  });

  it('names packaging as the probable weak point when clicks lag but retention holds', () => {
    const analysis = analysisWith({
      views: 470,
      peers: [400, 450, 470, 480, 500],
      ctr: 3.5, // well below the peer CTR of 6
      retention: 42, // at the peer level
    });
    const insight = generateRulesInsight(buildInsightFacts(analysis, 'לילה לבן'));

    expect(insight.recommendation).toContain('האריזה');
    // Stated as the likeliest explanation, never as a proven cause.
    expect(insight.recommendation).toContain('הסבירה');
  });

  it('points at the opening when retention lags but clicks are fine', () => {
    const analysis = analysisWith({
      views: 470,
      peers: [400, 450, 470, 480, 500],
      ctr: 6.5,
      retention: 22,
    });
    const insight = generateRulesInsight(buildInsightFacts(analysis, 'לילה לבן'));
    expect(insight.recommendation).toContain('הפתיחה');
  });

  it('refuses to analyse a video that is not benchmark-eligible', () => {
    const video = makeVideo({
      id: 'short-1',
      publishedDaysAgo: 3,
      durationSeconds: 48,
      contentType: 'short',
    });
    const snapshot = makeSnapshot({ videoId: 'short-1', target: 'h72', metrics: { views: 200_000 } });
    const analysis = analyseVideo({
      video,
      snapshots: [snapshot],
      candidates: makePeers([400, 450, 470, 480, 500]),
      target: 'h72',
      now: NOW,
    });

    const insight = generateRulesInsight(buildInsightFacts(analysis, 'לילה לבן'));
    expect(insight.summary).toContain('Short');
    expect(insight.confidence).toBe('low');
  });

  it('raises confidence only with a large, milestone-quality sample', () => {
    const small = generateRulesInsight(
      buildInsightFacts(
        analysisWith({ views: 620, peers: [400, 450, 470, 480, 500], ctr: 7, retention: 45 }),
        'לילה לבן',
      ),
    );
    const large = generateRulesInsight(
      buildInsightFacts(
        analysisWith({
          views: 620,
          peers: [400, 410, 450, 460, 470, 480, 490, 500],
          ctr: 7,
          retention: 45,
        }),
        'לילה לבן',
      ),
    );
    expect(small.confidence).toBe('medium');
    expect(large.confidence).toBe('high');
  });

  it('produces schema-valid output', () => {
    const insight = generateRulesInsight(
      buildInsightFacts(
        analysisWith({ views: 620, peers: [400, 450, 470, 480, 500], ctr: 7, retention: 45 }),
        'לילה לבן',
      ),
    );
    expect(validateInsightPayload(insight).ok).toBe(true);
  });
});

describe('buildInsightFacts', () => {
  it('lists absent metrics separately instead of sending zeros', () => {
    const analysis = analysisWith({ views: 620, peers: [400, 450, 470, 480, 500], ctr: null });
    const facts = buildInsightFacts(analysis, 'לילה לבן');

    expect(facts.metrics.some((m) => m.key === 'impressionsCtr')).toBe(false);
    expect(facts.missingMetrics.join(' ')).toContain('הקלקה');
  });

  it('carries the snapshot provenance so the model can hedge appropriately', () => {
    const video = makeVideo({ id: 'old-1', publishedDaysAgo: 200 });
    const snapshot = makeSnapshot({
      videoId: 'old-1',
      target: 'h72',
      source: 'daily_backfill',
      metrics: { views: 500 },
    });
    const facts = buildInsightFacts(
      analyseVideo({
        video,
        snapshots: [snapshot],
        candidates: makePeers([400, 450, 470, 480, 500]),
        target: 'h72',
        now: NOW,
      }),
      'לילה לבן',
    );

    expect(facts.snapshot?.source).toBe('daily_backfill');
    expect(facts.dataQualityNotes.join(' ')).toContain('קירוב');
  });
});

describe('generateInsight provider fallback', () => {
  const analysis = analysisWith({
    views: 620,
    peers: [400, 450, 470, 480, 500],
    ctr: 7,
    retention: 45,
  });

  it('uses the provider result when it validates', async () => {
    const provider: InsightProviderAdapter = {
      name: 'anthropic',
      model: 'test-model',
      generate: vi.fn().mockResolvedValue({
        summary: 'תובנה תקינה מהמודל על ביצועי הסרטון.',
        mainSignal: 'CTR מעל החציון',
        strengths: ['CTR גבוה'],
        weaknesses: [],
        recommendation: 'לשמר את הכיוון.',
        confidence: 'high',
      }),
    };

    const result = await generateInsight({ analysis, channelTitle: 'לילה לבן', provider });
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('test-model');
    expect(result.payload.summary).toContain('תובנה תקינה');
  });

  it('falls back to rules when the provider throws', async () => {
    const onError = vi.fn();
    const provider: InsightProviderAdapter = {
      name: 'anthropic',
      model: 'test-model',
      generate: vi.fn().mockRejectedValue(new Error('upstream 500')),
    };

    const result = await generateInsight({
      analysis,
      channelTitle: 'לילה לבן',
      provider,
      onError,
    });

    expect(result.provider).toBe('rules');
    expect(onError).toHaveBeenCalled();
    expect(validateInsightPayload(result.payload).ok).toBe(true);
  });

  it('falls back to rules when the provider returns malformed output', async () => {
    const onError = vi.fn();
    const provider: InsightProviderAdapter = {
      name: 'anthropic',
      model: 'test-model',
      // Missing required fields — must never reach the dashboard.
      generate: vi.fn().mockResolvedValue({ summary: 'חלקי בלבד' } as never),
    };

    const result = await generateInsight({
      analysis,
      channelTitle: 'לילה לבן',
      provider,
      onError,
    });

    expect(result.provider).toBe('rules');
    expect(onError).toHaveBeenCalled();
  });

  it('uses the rules provider when no AI provider is configured', async () => {
    const result = await generateInsight({ analysis, channelTitle: 'לילה לבן', provider: null });
    expect(result.provider).toBe('rules');
    expect(rulesProvider.name).toBe('rules');
  });
});
