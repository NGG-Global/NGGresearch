import { z } from 'zod';
import type { InsightPayload } from '@/lib/domain/types';

/**
 * The contract every insight provider must satisfy. Anything that fails this
 * schema is discarded rather than shown — a malformed AI response must never
 * reach the dashboard.
 */
export const insightPayloadSchema = z.object({
  summary: z.string().trim().min(8).max(400),
  mainSignal: z.string().trim().min(4).max(240),
  strengths: z.array(z.string().trim().min(2).max(240)).max(4),
  weaknesses: z.array(z.string().trim().min(2).max(240)).max(4),
  recommendation: z.string().trim().min(4).max(400),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type ValidatedInsightPayload = z.infer<typeof insightPayloadSchema>;

export interface InsightValidationResult {
  readonly ok: boolean;
  readonly payload: InsightPayload | null;
  readonly error: string | null;
}

export function validateInsightPayload(input: unknown): InsightValidationResult {
  const parsed = insightPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      payload: null,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; '),
    };
  }
  return { ok: true, payload: parsed.data, error: null };
}

/** JSON Schema mirror of the zod schema, used to force structured tool output. */
export const insightJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'משפט או שניים בעברית שמסבירים את התמונה הכללית' },
    mainSignal: { type: 'string', description: 'האות הבולט ביותר בנתונים' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'עד 3 חוזקות מבוססות מדדים' },
    weaknesses: { type: 'array', items: { type: 'string' }, description: 'עד 3 חולשות מבוססות מדדים' },
    recommendation: { type: 'string', description: 'המלצה מעשית אחת' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['summary', 'mainSignal', 'strengths', 'weaknesses', 'recommendation', 'confidence'],
  additionalProperties: false,
} as const;
