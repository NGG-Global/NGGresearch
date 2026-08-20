import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  aiInsightsEnabled,
  anthropicConfig,
  appMode,
  reachReportTypeId,
  reportingApiEnabled,
} from '@/lib/config/env';
import { loadChannelDataset } from '@/lib/data';
import { formatLongDate, formatRelativeAge, formatTime } from '@/lib/format';
import { AppShell } from '@/components/shell/AppShell';
import { SyncButton } from '@/components/shell/SyncButton';
import { DisconnectButton } from '@/components/settings/DisconnectButton';
import { StatusDot } from '@/components/ui/indicators';
import { MetricLabel } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const SYNC_STATUS_LABELS: Record<string, string> = {
  running: 'בריצה',
  success: 'הושלם בהצלחה',
  partial: 'הושלם חלקית',
  failed: 'נכשל',
};

export default async function SettingsPage() {
  const dataset = await loadChannelDataset();
  if (!dataset.channel && !dataset.loadError) redirect('/connect');

  const mode = appMode();
  const channel = dataset.channel;
  const run = dataset.lastSyncRun;
  const ai = anthropicConfig();

  return (
    <AppShell channel={channel} mode={mode} active="/settings">
      <div className="mx-auto grid max-w-[820px] gap-7 px-6 py-7 lg:px-8">
        <section>
          <MetricLabel className="tracking-[0.12em]">CONNECTED ACCOUNT</MetricLabel>
          <div className="mt-3.5 flex flex-wrap items-center gap-3.5 rounded-[9px] border border-line-strong bg-panel p-4">
            <Image
              src={channel?.avatarUrl ?? '/brand/channel-avatar.png'}
              alt=""
              width={38}
              height={38}
              className="size-[38px] rounded-full shadow-[0_0_0_1px_#2a2a32]"
            />
            <div className="min-w-0 flex-1">
              <div className="font-display text-[13.5px] leading-[1.3] font-semibold text-fg">
                {channel?.title ?? 'לא מחובר'}
              </div>
              <div className="mt-1.5">
                {mode === 'demo' ? (
                  <StatusDot tone="pending">נתוני הדגמה · לא מחובר ל-YouTube</StatusDot>
                ) : channel?.tokenStatus === 'valid' ? (
                  <StatusDot tone="positive">
                    מחובר
                    {channel.lastSuccessfulSyncAt
                      ? ` · סונכרן ${formatRelativeAge(channel.lastSuccessfulSyncAt)}`
                      : ''}
                  </StatusDot>
                ) : (
                  <StatusDot tone="negative">החיבור פג — יש להתחבר מחדש</StatusDot>
                )}
              </div>
            </div>
            <DisconnectButton
              disabled={mode === 'demo'}
              disabledReason="ניתוק אינו זמין במצב הדגמה"
            />
          </div>
          {channel && mode !== 'demo' ? (
            <p className="mt-2.5 text-[11.5px] leading-[1.6] text-dim-2">
              מחובר מאז {formatLongDate(channel.connectedAt)}. הניתוק מבטל את ההרשאה מול Google ומוחק
              את האסימונים מהשרת.
            </p>
          ) : null}
        </section>

        <section>
          <MetricLabel className="tracking-[0.12em]">SYNC</MetricLabel>
          <div className="mt-3.5 overflow-hidden rounded-[9px] border border-line-soft">
            <Row
              title="סנכרון ידני"
              hint="מביא מטא-דאטה, אנליטיקס ונקודות מדידה שנפתחו"
              control={
                <SyncButton
                  lastSuccessfulSyncAt={channel?.lastSuccessfulSyncAt ?? null}
                  disabled={mode === 'demo' || channel?.tokenStatus !== 'valid'}
                  disabledReason={
                    mode === 'demo' ? 'סנכרון אינו זמין במצב הדגמה' : 'יש להתחבר מחדש ל-YouTube'
                  }
                />
              }
            />
            <Row
              title="סנכרון מוצלח אחרון"
              hint={
                channel?.lastSuccessfulSyncAt
                  ? `${formatLongDate(channel.lastSuccessfulSyncAt)} · ${formatTime(
                      channel.lastSuccessfulSyncAt,
                    )}`
                  : 'טרם בוצע סנכרון מוצלח'
              }
              control={
                <span className="num text-[12px] leading-none text-dim">
                  {channel?.lastSuccessfulSyncAt
                    ? formatRelativeAge(channel.lastSuccessfulSyncAt)
                    : '—'}
                </span>
              }
            />
            <Row
              title="הריצה האחרונה"
              hint={
                run
                  ? [
                      SYNC_STATUS_LABELS[run.status] ?? run.status,
                      `${run.videosProcessed} סרטונים`,
                      `${run.snapshotsCreated} נקודות מדידה חדשות`,
                      run.error ?? null,
                      run.warnings.length > 0 ? `${run.warnings.length} אזהרות` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'אין עדיין ריצות מתועדות'
              }
              control={
                run ? (
                  <StatusDot
                    tone={
                      run.status === 'success'
                        ? 'positive'
                        : run.status === 'failed'
                          ? 'negative'
                          : run.status === 'partial'
                            ? 'pending'
                            : 'neutral'
                    }
                  >
                    {SYNC_STATUS_LABELS[run.status] ?? run.status}
                  </StatusDot>
                ) : (
                  <span className="text-[12px] leading-none text-dim">—</span>
                )
              }
              last
            />
          </div>
          {run && run.warnings.length > 0 ? (
            <ul className="mt-2.5 space-y-1">
              {run.warnings.slice(0, 5).map((warning) => (
                <li key={warning} className="text-[11.5px] leading-[1.6] text-dim">
                  · {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section>
          <MetricLabel className="tracking-[0.12em]">AI INSIGHTS</MetricLabel>
          <div className="mt-3.5 overflow-hidden rounded-[9px] border border-line-soft">
            <Row
              title="מנוע התובנות"
              hint={
                aiInsightsEnabled()
                  ? `Claude מחובר (${ai?.model}). בכשל, המערכת חוזרת לניתוח דטרמיניסטי.`
                  : 'לא הוגדר מפתח API. התובנות נוצרות מניתוח דטרמיניסטי מבוסס כללים.'
              }
              control={
                <StatusDot tone={aiInsightsEnabled() ? 'positive' : 'neutral'}>
                  {aiInsightsEnabled() ? 'פעיל' : 'ניתוח מבוסס כללים'}
                </StatusDot>
              }
            />
            <Row
              title="דוחות חשיפות"
              hint={
                reportingApiEnabled()
                  ? `דוח ${reachReportTypeId()} מה-Reporting API. הנתונים מגיעים בעיכוב, ועד אז החשיפות מסומנות כממתינות.`
                  : 'דוחות החשיפות מושבתים. חשיפות ו-CTR יסומנו כלא זמינים.'
              }
              control={
                <StatusDot tone={reportingApiEnabled() ? 'positive' : 'neutral'}>
                  {reportingApiEnabled() ? 'מופעל' : 'מושבת'}
                </StatusDot>
              }
              last
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Row({
  title,
  hint,
  control,
  last = false,
}: {
  title: string;
  hint: string;
  control: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3.5 bg-panel-alt px-4 py-4 ${
        last ? '' : 'border-b border-inset'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-[1.3] text-fg">{title}</div>
        <div className="mt-1 text-[11.5px] leading-[1.5] text-dim-2">{hint}</div>
      </div>
      {control}
    </div>
  );
}
