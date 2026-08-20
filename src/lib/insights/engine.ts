import type { VideoAnalysis } from '@/lib/analysis/video-analysis';
import { aiInsightsEnabled } from '@/lib/config/env';
import type { InsightPayload } from '@/lib/domain/types';
import { createAnthropicProvider } from './anthropic';
import { buildInsightFacts, type InsightFacts } from './facts';
import type { InsightGenerationResult, InsightProviderAdapter } from './provider';
import { generateRulesInsight } from './rules';
import { validateInsightPayload } from './schema';

export const rulesProvider: InsightProviderAdapter = {
  name: 'rules',
  model: null,
  async generate(facts: InsightFacts): Promise<InsightPayload> {
    return generateRulesInsight(facts);
  },
};

/**
 * Chooses the configured provider, and always falls back to the deterministic
 * rules engine — a failing AI call degrades the copy, never the dashboard.
 */
export async function generateInsight(params: {
  analysis: VideoAnalysis;
  channelTitle: string;
  provider?: InsightProviderAdapter | null;
  onError?: (error: unknown) => void;
}): Promise<InsightGenerationResult> {
  const facts = buildInsightFacts(params.analysis, params.channelTitle);
  const primary =
    params.provider ?? (aiInsightsEnabled() ? createAnthropicProvider() : null);

  if (primary) {
    try {
      const payload = await primary.generate(facts);
      const validation = validateInsightPayload(payload);
      if (validation.ok && validation.payload) {
        return { payload: validation.payload, provider: primary.name, model: primary.model };
      }
      params.onError?.(new Error(validation.error ?? 'insight validation failed'));
    } catch (error) {
      params.onError?.(error);
    }
  }

  return {
    payload: generateRulesInsight(facts),
    provider: 'rules',
    model: null,
  };
}

export { buildInsightFacts, generateRulesInsight };
export type { InsightFacts, InsightGenerationResult, InsightProviderAdapter };
