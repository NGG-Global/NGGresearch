import { NextResponse } from 'next/server';
import { clearOAuthState, verifyOAuthState } from '@/lib/auth/oauth-state';
import { hasGoogleOAuthConfig } from '@/lib/config/env';
import { saveCredentials, upsertChannel } from '@/lib/db/repositories';
import { fetchOwnChannel } from '@/lib/youtube/data-api';
import { exchangeCodeForTokens } from '@/lib/youtube/oauth';
import { runSync } from '@/lib/sync/service';

export const dynamic = 'force-dynamic';

/**
 * OAuth callback: validates state, exchanges the code, identifies the channel,
 * stores encrypted tokens and kicks off the initial sync.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/connect?error=${reason}`, request.url));

  if (!hasGoogleOAuthConfig()) return fail('not_configured');

  if (url.searchParams.get('error')) return fail('access_denied');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return fail('unknown');

  if (!(await verifyOAuthState(state))) return fail('invalid_state');
  await clearOAuthState();

  try {
    const tokens = await exchangeCodeForTokens(code);
    const metadata = await fetchOwnChannel(tokens.accessToken);

    const channel = await upsertChannel({
      youtubeChannelId: metadata.youtubeChannelId,
      title: metadata.title,
      avatarUrl: metadata.avatarUrl,
      subscriberCount: metadata.subscriberCount,
      videoCount: metadata.videoCount,
      viewCount: metadata.viewCount,
    });

    await saveCredentials(channel.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });

    // First import. Failures are recorded on the sync run, not thrown at the
    // user — they land on a dashboard that explains the state.
    await runSync({ trigger: 'initial' }).catch((error: unknown) => {
      console.error('[oauth] initial sync failed', error instanceof Error ? error.message : error);
    });

    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    // Never echo the upstream body: it can contain the code or client secret.
    console.error('[oauth] callback failed', error instanceof Error ? error.message : 'unknown');
    return fail('token_exchange');
  }
}
