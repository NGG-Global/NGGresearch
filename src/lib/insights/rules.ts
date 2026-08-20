import { INSUFFICIENT_BENCHMARK_MESSAGE_HE } from '@/lib/benchmark';
import type { InsightPayload } from '@/lib/domain/types';
import { formatSignedPercent } from '@/lib/format';
import { formatMetricValue } from '@/lib/format/metric';
import { metricsByDeviation, type InsightFacts, type InsightMetricFact } from './facts';

/**
 * Deterministic fallback used whenever no AI provider is configured or the
 * provider fails. It is not "fake AI text": every sentence is assembled from
 * the same measured comparisons the dashboard shows, and it says plainly when
 * the data does not support a conclusion.
 */
export function generateRulesInsight(facts: InsightFacts): InsightPayload {
  if (!facts.video.benchmarkEligible) {
    return {
      summary: `הסרטון סווג כ"${facts.video.contentTypeLabelHe}", ולכן הוא לא מושווה מול הסרטונים הרגילים של הערוץ.`,
      mainSignal: 'אין בסיס השוואה תקף לסוג התוכן הזה בגרסה הנוכחית.',
      strengths: [],
      weaknesses: [],
      recommendation: 'אפשר לעקוב אחרי המדדים הגולמיים למטה, או לסמן ידנית את סוג התוכן אם הסיווג שגוי.',
      confidence: 'low',
    };
  }

  if (!facts.comparison.hasEnoughData) {
    return {
      summary: INSUFFICIENT_BENCHMARK_MESSAGE_HE,
      mainSignal: describeRawState(facts),
      strengths: [],
      weaknesses: [],
      recommendation: `נמצאו ${facts.comparison.sampleSize} סרטונים דומים באותה נקודת זמן. כדאי לחזור להשוואה אחרי שיצטברו עוד סרטונים מאותו סוג.`,
      confidence: 'low',
    };
  }

  const ranked = metricsByDeviation(facts);
  const lead = ranked[0];
  if (!lead) {
    return {
      summary: 'המדדים קיימים, אבל אין מספיק מדדים ברי-השוואה כדי לזהות מגמה.',
      mainSignal: describeRawState(facts),
      strengths: [],
      weaknesses: [],
      recommendation: 'כדאי לחזור אחרי שיגיעו נתוני החשיפות וה-CTR מדוחות YouTube.',
      confidence: 'low',
    };
  }

  const positives = ranked.filter((m) => isPositive(m)).slice(0, 3);
  const negatives = ranked.filter((m) => isNegative(m)).slice(0, 3);

  return {
    summary: buildSummary(facts, positives, negatives),
    mainSignal: `${describeMetric(lead)} זהו הפער הגדול ביותר מול הסרטונים הדומים בנקודה הזו.`,
    strengths: positives.map(describeMetric),
    weaknesses: negatives.map(describeMetric),
    recommendation: buildRecommendation(facts, positives, negatives),
    confidence: assessConfidence(facts),
  };
}

function buildSummary(
  facts: InsightFacts,
  positives: readonly InsightMetricFact[],
  negatives: readonly InsightMetricFact[],
): string {
  const stage = facts.snapshot
    ? `בנקודת ${facts.snapshot.targetLabelHe}`
    : `בגיל ${facts.video.ageLabelHe}`;
  const sample = `מול ${facts.comparison.sampleSize} סרטונים דומים`;

  if (positives.length > 0 && negatives.length === 0) {
    return `${stage} הסרטון מוביל ${sample}: ${joinHe(positives.slice(0, 2).map(shortDescribe))}.`;
  }
  if (negatives.length > 0 && positives.length === 0) {
    return `${stage} הסרטון מתחת לביצוע הטיפוסי ${sample}: ${joinHe(negatives.slice(0, 2).map(shortDescribe))}.`;
  }
  if (positives.length > 0 && negatives.length > 0) {
    return `${stage} התמונה מעורבת ${sample}. ${joinHe(positives.slice(0, 1).map(shortDescribe))}, לעומת זאת ${joinHe(negatives.slice(0, 1).map(shortDescribe))}.`;
  }
  return `${stage} הסרטון נע בתחום הטיפוסי של הערוץ ${sample}, בלי פער בולט באף מדד.`;
}

function buildRecommendation(
  facts: InsightFacts,
  positives: readonly InsightMetricFact[],
  negatives: readonly InsightMetricFact[],
): string {
  const ctr = find(facts, 'impressionsCtr');
  const retention = find(facts, 'averageViewPercentage');
  const views = find(facts, 'views');
  const subs = find(facts, 'subscribersPer1kViews');

  // Low clicks, healthy retention: packaging is the most probable constraint.
  if (ctr && isNegative(ctr) && retention && !isNegative(retention)) {
    return 'הצופים שנכנסים נשארים, אבל פחות אנשים לוחצים. אם המגמה תימשך, האריזה — תמונה וכותרת — היא נקודת החולשה הסבירה ביותר לבדיקה בסרטון הבא.';
  }

  // Clicks fine, retention weak: the opening or pacing is the likelier issue.
  if (retention && isNegative(retention) && ctr && !isNegative(ctr)) {
    return 'האריזה עובדת אבל הצפייה נושרת מוקדם מהרגיל. כדאי להשוות את הפתיחה של הסרטון לפתיחות של הסרטונים שהחזיקו טוב יותר.';
  }

  if (views && isNegative(views) && ctr && !isNegative(ctr) && retention && !isNegative(retention)) {
    return 'המדדים האיכותיים תקינים והפער הוא בהיקף החשיפה. שווה לעקוב עוד כמה ימים לפני שמסיקים משהו על התוכן עצמו.';
  }

  if (subs && isPositive(subs)) {
    return 'הסרטון ממיר צופים למנויים בקצב גבוה מהרגיל. כדאי לבדוק מה בפורמט הזה גורם לזה, לקראת הסרטון הבא.';
  }

  if (positives.length > 0 && negatives.length === 0) {
    return `הכיוון עובד. כדאי לשמר את מה שהוביל ל${positives[0]!.labelHe} החזק בסרטונים הבאים.`;
  }

  if (negatives.length > 0) {
    return `הפער המרכזי הוא ב${negatives[0]!.labelHe}. שווה לבדוק אותו לפני שמשנים משהו אחר.`;
  }

  return 'אין כרגע פער שמצדיק שינוי. כדאי להמשיך לעקוב בנקודת המדידה הבאה.';
}

function describeRawState(facts: InsightFacts): string {
  const views = find(facts, 'views');
  if (views && views.value !== null) {
    const stage = facts.snapshot ? ` בנקודת ${facts.snapshot.targetLabelHe}` : '';
    return `הסרטון עומד על ${formatMetricValue('views', views.value)} צפיות${stage}, ללא בסיס השוואה מספק.`;
  }
  return 'עדיין אין מדדים זמינים לסרטון הזה.';
}

function describeMetric(metric: InsightMetricFact): string {
  const value = metric.value !== null ? formatMetricValue(metric.key, metric.value) : '—';
  const benchmark =
    metric.benchmarkMedian !== null ? formatMetricValue(metric.key, metric.benchmarkMedian) : '—';
  const diff = metric.percentDifference !== null ? ` (${formatSignedPercent(metric.percentDifference)})` : '';
  return `${metric.labelHe}: ${value} מול חציון ${benchmark}${diff}.`;
}

function shortDescribe(metric: InsightMetricFact): string {
  const diff = metric.percentDifference !== null ? formatSignedPercent(metric.percentDifference) : '';
  return `${metric.labelHe} ${diff} מול החציון`;
}

function assessConfidence(facts: InsightFacts): 'high' | 'medium' | 'low' {
  if (facts.comparison.sampleSize >= 8 && facts.comparison.quality === 'milestone') return 'high';
  if (facts.comparison.sampleSize >= 5 && facts.comparison.quality !== 'approximate') return 'medium';
  return 'low';
}

function find(facts: InsightFacts, key: InsightMetricFact['key']): InsightMetricFact | null {
  return facts.metrics.find((m) => m.key === key) ?? null;
}

function isPositive(metric: InsightMetricFact): boolean {
  return metric.status === 'strong' || metric.status === 'exceptional';
}

function isNegative(metric: InsightMetricFact): boolean {
  return metric.status === 'weak';
}

function joinHe(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} ו${parts[parts.length - 1]}`;
}
