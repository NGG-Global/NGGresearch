import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { sessionSecret } from '@/lib/config/env';

const COOKIE_NAME = 'll_oauth_state';
const MAX_AGE_SECONDS = 600;

/**
 * CSRF protection for the OAuth round trip.
 *
 * A random nonce goes to Google as `state` and its HMAC into an httpOnly
 * cookie. The callback only proceeds when the two agree, which stops an
 * attacker-initiated callback from binding their channel to this instance.
 */
export async function issueOAuthState(): Promise<string> {
  const nonce = randomBytes(32).toString('base64url');
  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(nonce), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  return nonce;
}

export async function verifyOAuthState(nonce: string | null): Promise<boolean> {
  if (!nonce) return false;
  const jar = await cookies();
  const stored = jar.get(COOKIE_NAME)?.value;
  if (!stored) return false;

  const expected = Buffer.from(sign(nonce));
  const actual = Buffer.from(stored);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function clearOAuthState(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

function sign(nonce: string): string {
  return createHmac('sha256', sessionSecret()).update(nonce).digest('base64url');
}
