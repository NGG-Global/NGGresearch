import type { InsightPayload } from '@/lib/domain/types';
import { anthropicConfig } from '@/lib/config/env';
import type { InsightFacts } from './facts';
import type { InsightProviderAdapter } from './provider';
import { insightJsonSchema, validateInsightPayload } from './schema';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TOOL_NAME = 'report_insight';

const SYSTEM_PROMPT = `אתה אנליסט יוטיוב שמנתח ערוץ אימה בעברית.
אתה מקבל גיליון עובדות מדויק (facts) ומחזיר תובנה קצרה בעברית טבעית ומקצועית.

חוקים מחייבים:
1. כל טענה חייבת להסתמך על מספר שמופיע בגיליון העובדות. אין להמציא מדדים, אחוזים או נתונים שלא נמסרו.
2. אין להציג השערה כעובדה סיבתית. במקום "ה-thumbnail גרוע" יש לכתוב "האריזה היא כרגע נקודת החולשה הסבירה ביותר".
3. אם comparison.hasEnoughData הוא false — יש לומר במפורש שאין מספיק נתונים להשוואה אמינה, ולא לקבוע מסקנות.
4. אין להתייחס למדדים שמופיעים ב-missingMetrics כאילו הם אפס. הם פשוט לא ידועים.
5. שפה: עברית עסקית, ישירה, בלי סופרלטיבים ובלי אימוג'ים. מותר להשתמש במונחים לטיניים מקובלים כמו CTR.
6. קצר: summary עד שני משפטים, כל פריט ברשימות משפט אחד.
7. confidence נקבע לפי גודל המדגם ואיכות הנתונים: high רק אם sampleSize גדול מ-7 ואיכות ההשוואה milestone.`;

export function createAnthropicProvider(): InsightProviderAdapter | null {
  const config = anthropicConfig();
  if (!config) return null;

  return {
    name: 'anthropic',
    model: config.model,
    async generate(facts: InsightFacts): Promise<InsightPayload> {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          system: SYSTEM_PROMPT,
          tools: [
            {
              name: TOOL_NAME,
              description: 'החזרת התובנה במבנה מוגדר',
              input_schema: insightJsonSchema,
            },
          ],
          tool_choice: { type: 'tool', name: TOOL_NAME },
          messages: [
            {
              role: 'user',
              content: `להלן גיליון העובדות של הסרטון. החזר תובנה מובנית.\n\n${JSON.stringify(facts, null, 2)}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        // Body may contain request context; keep it out of the thrown message.
        throw new Error(`Anthropic API returned ${response.status}`);
      }

      const body: unknown = await response.json();
      const toolInput = extractToolInput(body);
      const validation = validateInsightPayload(toolInput);
      if (!validation.ok || !validation.payload) {
        throw new Error(`Insight failed validation: ${validation.error ?? 'unknown reason'}`);
      }
      return validation.payload;
    },
  };
}

function extractToolInput(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return null;
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;

  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const typed = block as { type?: string; name?: string; input?: unknown; text?: string };
    if (typed.type === 'tool_use' && typed.name === TOOL_NAME) return typed.input;
    // Defensive fallback: a text block containing the JSON object.
    if (typed.type === 'text' && typeof typed.text === 'string') {
      const parsed = tryParseJson(typed.text);
      if (parsed) return parsed;
    }
  }
  return null;
}

function tryParseJson(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
