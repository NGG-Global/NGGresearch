import { formatVideoAge } from '@/lib/format';
import { milestoneLabel, missedMilestones } from '@/lib/domain/snapshots';
import type { Channel, SyncRun } from '@/lib/domain/types';
import type { VideoAnalysis } from './video-analysis';
import { benchmarkOf } from './video-analysis';

export type AttentionSeverity = 'alert' | 'watch' | 'positive' | 'info';

export type AttentionKind =
  | 'packaging_weakness'
  | 'low_retention'
  | 'strong_subscriber_conversion'
  | 'insufficient_benchmark'
  | 'analytics_pending'
  | 'reach_data_pending'
  | 'milestone_gap'
  | 'connection_issue'
  | 'sync_issue';

export interface AttentionSignal {
  readonly id: string;
  readonly kind: AttentionKind;
  readonly severity: AttentionSeverity;
  readonly titleHe: string;
  readonly detailHe: string;
  readonly videoId?: string;
  readonly videoTitle?: string;
}

/** Shown when there is genuinely nothing to act on. */
export const NOTHING_TO_ATTEND_HE = 'הכול נראה תקין כרגע.';

/**
 * Produces only signals that are backed by data we actually hold. An empty
 * result is a valid, common outcome — the card is never padded to look busy.
 */
export function attentionSignals(params: {
  analyses: readonly VideoAnalysis[];
  channel: Channel | null;
  lastSyncRun: SyncRun | null;
}): readonly AttentionSignal[] {
  const { analyses, channel, lastSyncRun } = params;
  const signals: AttentionSignal[] = [];

  if (channel && channel.tokenStatus !== 'valid') {
    signals.push({
      id: 'connection',
      kind: 'connection_issue',
      severity: 'alert',
      titleHe: 'החיבור ל-YouTube פג',
      detailHe: channel.lastSuccessfulSyncAt
        ? 'הנתונים המוצגים הם מהסנכרון המוצלח האחרון. יש להתחבר מחדש כדי לרענן.'
        : 'יש להתחבר מחדש כדי להתחיל לאסוף נתונים.',
    });
  }

  if (lastSyncRun && (lastSyncRun.status === 'failed' || lastSyncRun.status === 'partial')) {
    signals.push({
      id: `sync-${lastSyncRun.id}`,
      kind: 'sync_issue',
      severity: lastSyncRun.status === 'failed' ? 'alert' : 'watch',
      titleHe: lastSyncRun.status === 'failed' ? 'הסנכרון האחרון נכשל' : 'הסנכרון האחרון הושלם חלקית',
      detailHe:
        lastSyncRun.error ??
        (lastSyncRun.warnings.length > 0
          ? lastSyncRun.warnings.join(' · ')
          : 'חלק מהנתונים לא נמשכו. אפשר להריץ סנכרון נוסף.'),
    });
  }

  for (const analysis of analyses) {
    const { video } = analysis;
    const ctr = benchmarkOf(analysis, 'impressionsCtr');
    const retention = benchmarkOf(analysis, 'averageViewPercentage');
    const subsRate = benchmarkOf(analysis, 'subscribersPer1kViews');

    // Packaging signal: fewer clicks than usual, but the viewers who do arrive
    // stay at least as long as usual. Stated as a probable cause, never proven.
    if (
      ctr?.status === 'weak' &&
      retention &&
      (retention.status === 'typical' || retention.status === 'strong' || retention.status === 'exceptional')
    ) {
      signals.push({
        id: `packaging-${video.id}`,
        kind: 'packaging_weakness',
        severity: 'watch',
        titleHe: 'ייתכן שהאריזה חלשה',
        detailHe: `ה-CTR נמוך מהחציון של הסרטונים הדומים, בזמן שאחוז הצפייה נשמר. זו נקודת החולשה הסבירה ביותר, לא מסקנה מוכחת (${ctr.sampleSize} סרטוני השוואה).`,
        videoId: video.id,
        videoTitle: video.title,
      });
    }

    if (retention?.status === 'weak' && retention.standsOutFromSpread) {
      signals.push({
        id: `retention-${video.id}`,
        kind: 'low_retention',
        severity: 'watch',
        titleHe: 'אחוז צפייה נמוך מהרגיל',
        detailHe: `אחוז הצפייה הממוצע חורג למטה מהפיזור של ${retention.sampleSize} הסרטונים הדומים.`,
        videoId: video.id,
        videoTitle: video.title,
      });
    }

    if (subsRate?.status === 'exceptional') {
      signals.push({
        id: `subs-${video.id}`,
        kind: 'strong_subscriber_conversion',
        severity: 'positive',
        titleHe: 'המרה חזקה למנויים',
        detailHe: `הסרטון מגייס מנויים בקצב גבוה מהחציון של הסרטונים הדומים (${subsRate.sampleSize} סרטוני השוואה).`,
        videoId: video.id,
        videoTitle: video.title,
      });
    }
  }

  const latest = analyses[0];
  if (latest) {
    if (!latest.comparison.hasEnoughData && latest.video.classification.benchmarkEligible) {
      signals.push({
        id: `benchmark-${latest.video.id}`,
        kind: 'insufficient_benchmark',
        severity: 'info',
        titleHe: 'אין בסיס השוואה מספק',
        detailHe: `נמצאו ${latest.comparison.sampleSize} סרטונים דומים באותה נקודת זמן. עדיין אין מספיק נתונים להשוואה אמינה.`,
        videoId: latest.video.id,
        videoTitle: latest.video.title,
      });
    }

    const pendingReach =
      latest.snapshot?.metrics.impressions.state === 'pending' ||
      latest.snapshot?.metrics.impressionsCtr.state === 'pending';
    if (pendingReach) {
      signals.push({
        id: `reach-${latest.video.id}`,
        kind: 'reach_data_pending',
        severity: 'info',
        titleHe: 'נתוני חשיפות טרם הגיעו',
        detailHe: 'דוחות ה-Reporting API של YouTube מתעדכנים בעיכוב. החשיפות וה-CTR יופיעו ברגע שהדוח יגיע.',
        videoId: latest.video.id,
        videoTitle: latest.video.title,
      });
    }

    if (!latest.snapshot && latest.ageHours < 48) {
      signals.push({
        id: `pending-${latest.video.id}`,
        kind: 'analytics_pending',
        severity: 'info',
        titleHe: 'הסרטון חדש מדי לניתוח',
        detailHe: `הסרטון פורסם לפני ${formatVideoAge(latest.ageHours)}. YouTube מספק אנליטיקס בעיכוב של עד 48 שעות.`,
        videoId: latest.video.id,
        videoTitle: latest.video.title,
      });
    }

    const gaps = missedMilestones(latest.ageHours, latest.snapshots);
    if (gaps.length > 0) {
      signals.push({
        id: `gap-${latest.video.id}`,
        kind: 'milestone_gap',
        severity: 'info',
        titleHe: 'חסרות נקודות מדידה',
        detailHe: `לא נלכדה מדידה בגיל ${gaps
          .map((m) => milestoneLabel(m.target))
          .join(' · ')}. אפשר להשוות רק מול נקודות שנמדדו באמת.`,
        videoId: latest.video.id,
        videoTitle: latest.video.title,
      });
    }
  }

  return signals;
}
