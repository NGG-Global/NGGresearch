import { NextResponse } from 'next/server';
import { hasGoogleOAuthConfig } from '@/lib/config/env';
import { issueOAuthState } from '@/lib/auth/oauth-state';
import { buildAuthorizationUrl } from '@/lib/youtube/oauth';

export const dynamic = 'force-dynamic';

/** Starts the Google OAuth flow. */
export async function GET(request: Request) {
  if (!hasGoogleOAuthConfig()) {
    return NextResponse.redirect(new URL('/connect?error=not_configured', request.url));
  }

  try {
    const state = await issueOAuthState();
    return NextResponse.redirect(buildAuthorizationUrl(state));
  } catch (error) {
    console.error('[oauth] failed to start flow', error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL('/connect?error=not_configured', request.url));
  }
}
