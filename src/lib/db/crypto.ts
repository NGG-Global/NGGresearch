import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { encryptionKey } from '@/lib/config/env';

/**
 * AES-256-GCM for the Google refresh/access tokens at rest.
 *
 * Tokens are already isolated in their own table with RLS on and grants
 * revoked; encrypting them means a database dump alone is not enough to call
 * the YouTube API as the channel owner.
 */

const FORMAT_VERSION = 'v1';
const IV_BYTES = 12;

function key(): Buffer {
  const raw = encryptionKey();
  const buffer = decodeKey(raw);
  if (buffer.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits).');
  }
  return buffer;
}

function decodeKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const base64 = Buffer.from(raw, 'base64');
  if (base64.length === 32) return base64;
  return Buffer.from(raw, 'utf8');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  );
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(':');
  if (version !== FORMAT_VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error('Stored secret is not in the expected v1 envelope format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
