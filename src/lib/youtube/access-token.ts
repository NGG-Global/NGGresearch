import 'server-only';
import {
  getCredentials,
  markTokenStatus,
  saveCredentials,
} from '@/lib/db/repositories';
import { YouTubeApiError } from './errors';
import { refreshAccessToken } from './oauth';

/** Refresh a little early so a long sync does not expire mid-run. */
const EXPIRY_SKEW_MS = 120_000;

/**
 * Returns a usable access token for the channel, refreshing and re-persisting
 * it when needed. Tokens never leave the server and are never logged.
 */
export async function getAccessToken(channelId: string): Promise<string> {
  const credentials = await getCredentials(channelId);
  if (!credentials) {
    throw new YouTubeApiError({
      message: 'No stored credentials for channel',
      kind: 'auth_expired',
      api: 'oauth',
    });
  }

  const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : 0;
  const stillValid = credentials.accessToken && expiresAt - EXPIRY_SKEW_MS > Date.now();
  if (stillValid && credentials.accessToken) return credentials.accessToken;

  if (!credentials.refreshToken) {
    await markTokenStatus(channelId, 'expired');
    throw new YouTubeApiError({
      message: 'Access token expired and no refresh token is stored',
      kind: 'auth_expired',
      api: 'oauth',
    });
  }

  try {
    const refreshed = await refreshAccessToken(credentials.refreshToken);
    await saveCredentials(channelId, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope,
    });
    return refreshed.accessToken;
  } catch (error) {
    await markTokenStatus(channelId, 'expired');
    throw error;
  }
}
