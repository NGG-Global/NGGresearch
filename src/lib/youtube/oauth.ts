import 'server-only';
import { googleOAuthConfig } from '@/lib/config/env';
import { YouTubeApiError, kindFromStatus } from './errors';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/**
 * Minimum scopes for V1.
 *  - youtube.readonly     : channel metadata, uploads playlist, video metadata
 *  - yt-analytics.readonly: YouTube Analytics reports and non-monetary
 *                           Reporting API jobs (reach reports)
 * No write, upload or monetary scope is requested.
 */
export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
] as const;

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

export function buildAuthorizationUrl(state: string): string {
  const config = googleOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    // Offline access + consent so a refresh token is issued and scheduled sync
    // can keep running without the user signing in again.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const config = googleOAuthConfig();
  return requestToken({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const config = googleOAuthConfig();
  return requestToken({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  // A failed revoke is not fatal: local credentials are deleted regardless.
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    // Never log or surface the response body: it can echo the code/secret.
    throw new YouTubeApiError({
      message: `Google token endpoint returned ${response.status}`,
      kind: response.status === 400 || response.status === 401 ? 'auth_expired' : kindFromStatus(response.status),
      status: response.status,
      api: 'oauth',
    });
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!payload.access_token) {
    throw new YouTubeApiError({
      message: 'Google token response did not include an access token',
      kind: 'auth_expired',
      api: 'oauth',
    });
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
    scope: payload.scope ?? null,
  };
}
