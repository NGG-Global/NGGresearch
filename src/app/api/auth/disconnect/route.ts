import { NextResponse } from 'next/server';
import { deleteChannel, getChannel, getCredentials } from '@/lib/db/repositories';
import { revokeToken } from '@/lib/youtube/oauth';

export const dynamic = 'force-dynamic';

/** Revokes the Google grant and deletes the channel and all its data. */
export async function POST() {
  try {
    const channel = await getChannel();
    if (!channel) return NextResponse.json({ ok: true });

    const credentials = await getCredentials(channel.id);
    const token = credentials?.refreshToken ?? credentials?.accessToken;
    if (token) await revokeToken(token);

    await deleteChannel(channel.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[auth] disconnect failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'הניתוק נכשל. יש לנסות שוב.' }, { status: 500 });
  }
}
