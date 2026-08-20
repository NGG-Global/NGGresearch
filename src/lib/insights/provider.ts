import type { InsightPayload } from '@/lib/domain/types';
import type { InsightFacts } from './facts';

export interface InsightGenerationResult {
  readonly payload: InsightPayload;
  readonly provider: 'anthropic' | 'rules';
  readonly model: string | null;
}

export interface InsightProviderAdapter {
  readonly name: 'anthropic' | 'rules';
  readonly model: string | null;
  generate(facts: InsightFacts): Promise<InsightPayload>;
}
