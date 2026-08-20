import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { aiInsightsEnabled, anthropicConfig, isDemoMode } from '@/lib/config/env';
import type { InsightPayload, InsightProvider } from '@/lib/domain/types';
import { createAnthropicProvider } from './anthropic';
import { generateInsight } from './engine';
import { rulesProvider } from './engine';

export interface ResolvedInsight {
  readonly payload: InsightPayload;
  readonly provider: InsightProvider;
  readonly model: string | null;
  readonly generatedAt: string;
  readonly cached: boolean;
  /** Set when the AI provider failed and the rules engine answered instead. */
  readonly degraded: boolean;
}

const PROVIDER_LABELS: Record<InsightProvider, string> = {
  anthropic: 'נוצר על ידי Claude',
  rules: 'ניתוח דטרמיניסטי',
};

export function providerLabel(provider: InsightProvider, model: string | null): string {
  const base = PROVIDER_LABELS[provider];
  return provider === 'anthropic' && model ? `${base} (${model})` : base;
}

/**
 * Returns the insight for an analysis, reusing a stored one when it is still
 * newer than the snapshot it describes.
 *
 * Demo mode uses the deterministic rules engine by default so opening the
 * dashboard does not spend API credits on every render; set
 * AI_INSIGHTS_IN_DEMO=true to exercise the Claude path with demo data.
 */
export async function resolveInsight(params: {
  analysis: VideoAnalysis;
  channelTitle: string;
}): Promise<ResolvedInsight | null> {
  const { analysis, channelTitle } = params;
  if (!analysis.snapshot || !analysis.target) return null;

  const demo = isDemoMode();
  const useAiInDemo = process.env.AI_INSIGHTS_IN_DEMO === 'true';

  if (!demo) {
    const cached = await readCachedInsight(analysis);
    if (cached) return cached;
  }

  let degraded = false;
  const provider =
    demo && !useAiInDemo
      ? rulesProvider
      : aiInsightsEnabled()
        ? createAnthropicProvider()
        : rulesProvider;

  const result = await generateInsight({
    analysis,
    channelTitle,
    provider,
    onError: (error) => {
      degraded = true;
      // Insight failures are visible in the UI; log without payload details.
      console.error('[insights] provider failed', error instanceof Error ? error.message : error);
    },
  });

  const resolved: ResolvedInsight = {
    payload: result.payload,
    provider: result.provider,
    model: result.model,
    generatedAt: new Date().toISOString(),
    cached: false,
    degraded: degraded && result.provider === 'rules' && anthropicConfig() !== null,
  };

  if (!demo) await persistInsight(analysis, resolved);
  return resolved;
}

async function readCachedInsight(analysis: VideoAnalysis): Promise<ResolvedInsight | null> {
  if (!analysis.target || !analysis.snapshot) return null;
  try {
    const { getInsight } = await import('@/lib/db/repositories');
    const stored = await getInsight(analysis.video.id, analysis.target);
    if (!stored) return null;

    // Regenerate once the snapshot behind the insight has been refreshed.
    if (new Date(stored.generatedAt).getTime() < new Date(analysis.snapshot.capturedAt).getTime()) {
      return null;
    }

    return {
      payload: stored.payload,
      provider: stored.provider,
      model: stored.model,
      generatedAt: stored.generatedAt,
      cached: true,
      degraded: false,
    };
  } catch {
    return null;
  }
}

async function persistInsight(analysis: VideoAnalysis, resolved: ResolvedInsight): Promise<void> {
  if (!analysis.target) return;
  try {
    const { saveInsight } = await import('@/lib/db/repositories');
    await saveInsight({
      videoId: analysis.video.id,
      snapshotTarget: analysis.target,
      provider: resolved.provider,
      model: resolved.model,
      payload: resolved.payload,
    });
  } catch (error) {
    console.error('[insights] failed to persist', error instanceof Error ? error.message : error);
  }
}
