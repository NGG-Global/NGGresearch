import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { appMode, hasGoogleOAuthConfig } from '@/lib/config/env';
import { loadChannelDataset } from '@/lib/data';
import { OAUTH_SCOPES } from '@/lib/youtube/oauth';

export const dynamic = 'force-dynamic';

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'https://www.googleapis.com/auth/yt-analytics.readonly':
    'צפיות, זמן צפייה, אחוזי צפייה, מנויים ודוחות חשיפה',
  'https://www.googleapis.com/auth/youtube.readonly':
    'רשימת סרטונים, כותרות, תמונות ממוזערות ומטא-דאטה',
};

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: 'ההרשאה בוטלה. אפשר לנסות שוב בכל רגע.',
  invalid_state: 'בקשת ההתחברות לא אומתה. יש להתחיל את התהליך מחדש.',
  no_channel: 'לחשבון Google שנבחר אין ערוץ YouTube.',
  token_exchange: 'החלפת אסימוני ההרשאה נכשלה. יש לנסות שוב.',
  not_configured: 'חיבור Google אינו מוגדר בשרת. יש להשלים את משתני הסביבה.',
  unknown: 'ההתחברות נכשלה. יש לנסות שוב.',
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, dataset] = await Promise.all([searchParams, loadChannelDataset()]);
  const mode = appMode();

  // Already connected — the dashboard is the right place to be. In demo mode the
  // screen stays reachable so it can be worked on before credentials exist.
  if (mode !== 'demo' && dataset.channel && dataset.channel.tokenStatus === 'valid') {
    redirect('/');
  }
  const configured = hasGoogleOAuthConfig();

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="connect-glow w-full max-w-[620px] rounded-[10px] border border-line-strong bg-canvas px-8 py-14 text-center sm:px-14">
        <Image
          src="/brand/channel-avatar.png"
          alt=""
          width={78}
          height={78}
          className="mx-auto size-[78px] rounded-full shadow-[0_0_0_1px_#2a2a32,0_0_34px_rgba(224,21,33,0.32)]"
          priority
        />

        <h1 className="mt-6.5 font-display text-[22px] leading-[1.4] font-semibold tracking-[-0.015em] text-fg text-pretty sm:text-[25px]">
          חבר את חשבון ה-YouTube שלך
        </h1>
        <p className="mx-auto mt-3 max-w-[360px] text-[13.5px] leading-[1.7] text-muted text-pretty">
          אנחנו קוראים נתוני אנליטיקס בלבד. אין הרשאת פרסום, מחיקה או שינוי בערוץ.
        </p>

        {error ? (
          <p className="mx-auto mt-5 max-w-[400px] rounded-[8px] bg-accent/10 px-4 py-3 text-[12.5px] leading-[1.6] text-negative ring-1 ring-inset ring-accent/25">
            {OAUTH_ERRORS[error] ?? OAUTH_ERRORS.unknown}
          </p>
        ) : null}

        {configured ? (
          <a
            href="/api/auth/google"
            className="mt-7 inline-flex items-center gap-2.5 rounded-[8px] bg-accent px-7 py-3.5 text-[14px] leading-none font-semibold text-white shadow-[0_6px_20px_rgba(224,21,33,0.32)] transition-colors hover:bg-accent/90"
          >
            התחבר עם Google
          </a>
        ) : (
          <div className="mt-7 rounded-[8px] border border-line-strong bg-panel px-5 py-4 text-start">
            <p className="text-[13px] leading-[1.7] text-fg-3">
              חיבור Google עדיין לא מוגדר בשרת.
              {mode === 'demo'
                ? ' האפליקציה פועלת כרגע במצב הדגמה עם נתונים לדוגמה.'
                : ''}
            </p>
            <p className="mt-2 text-[12px] leading-[1.6] text-dim">
              יש להגדיר את המשתנים GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ו-APP_BASE_URL. הפירוט
              המלא נמצא בקובץ .env.example וב-README.
            </p>
            <Link
              href="/"
              className="mt-3.5 inline-block text-[12.5px] leading-none font-semibold text-accent-soft transition-colors hover:text-accent"
            >
              המשך למצב הדגמה →
            </Link>
          </div>
        )}

        <div className="mt-9 border-t border-line pt-5.5 text-start">
          <div className="metric-label text-[10px] tracking-[0.12em] text-dim">SCOPES REQUESTED</div>
          <ul className="mt-4 grid gap-3">
            {OAUTH_SCOPES.map((scope) => (
              <li key={scope} className="flex items-start gap-3">
                <span
                  className="mt-0.5 size-4 flex-none rounded-[4px] bg-inset ring-1 ring-inset ring-edge-3"
                  aria-hidden
                />
                <div>
                  <div className="metric-label text-[11px] tracking-normal text-fg-4">
                    {scope.replace('https://www.googleapis.com/auth/', '')}
                  </div>
                  <div className="mt-1.5 text-[12.5px] leading-[1.6] text-muted-2">
                    {SCOPE_DESCRIPTIONS[scope] ?? ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[11.5px] leading-[1.6] text-dim-2">
            אפשר לנתק בכל רגע מתוך ההגדרות.
          </p>
        </div>
      </div>
    </main>
  );
}
