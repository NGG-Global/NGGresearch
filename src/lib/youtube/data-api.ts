import { classifyVideo, parseIsoDuration } from '@/lib/domain/classification';
import type { PrivacyStatus } from '@/lib/domain/types';
import type { VideoUpsertInput } from '@/lib/db/repositories';
import { YouTubeApiError } from './errors';
import { googleFetch } from './http';

const BASE = 'https://www.googleapis.com/youtube/v3';
const API = 'youtube.data';
const PAGE_SIZE = 50;

export interface YouTubeChannelMetadata {
  youtubeChannelId: string;
  title: string;
  avatarUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: number | null;
  uploadsPlaylistId: string | null;
}

interface ChannelListResponse {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> };
    statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

/** The authenticated user's own channel. */
export async function fetchOwnChannel(accessToken: string): Promise<YouTubeChannelMetadata> {
  const url = `${BASE}/channels?part=snippet,statistics,contentDetails&mine=true`;
  const body = await googleFetch<ChannelListResponse>({ url, accessToken, api: API });
  const item = body.items?.[0];
  if (!item?.id) {
    throw new YouTubeApiError({
      message: 'The authenticated Google account has no YouTube channel',
      kind: 'not_found',
      api: API,
    });
  }

  const thumbnails = item.snippet?.thumbnails ?? {};
  return {
    youtubeChannelId: item.id,
    title: item.snippet?.title ?? 'ערוץ ללא שם',
    avatarUrl:
      thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
    subscriberCount: toNumber(item.statistics?.subscriberCount),
    videoCount: toNumber(item.statistics?.videoCount),
    viewCount: toNumber(item.statistics?.viewCount),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

interface PlaylistItemsResponse {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
  nextPageToken?: string;
}

/** Video ids from the channel's uploads playlist, newest first. */
export async function fetchUploadedVideoIds(
  accessToken: string,
  uploadsPlaylistId: string,
  limit = 200,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(PAGE_SIZE, limit - ids.length)),
    });
    if (pageToken) params.set('pageToken', pageToken);

    const body = await googleFetch<PlaylistItemsResponse>({
      url: `${BASE}/playlistItems?${params.toString()}`,
      accessToken,
      api: API,
    });

    for (const item of body.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = body.nextPageToken;
  } while (pageToken && ids.length < limit);

  return ids;
}

interface VideoListResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      liveBroadcastContent?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    contentDetails?: { duration?: string };
    status?: { privacyStatus?: string };
    liveStreamingDetails?: Record<string, unknown>;
  }>;
}

/** Full metadata for up to `ids.length` videos, batched 50 at a time. */
export async function fetchVideoMetadata(
  accessToken: string,
  ids: readonly string[],
): Promise<VideoUpsertInput[]> {
  const results: VideoUpsertInput[] = [];

  for (let index = 0; index < ids.length; index += PAGE_SIZE) {
    const batch = ids.slice(index, index + PAGE_SIZE);
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,status,liveStreamingDetails',
      id: batch.join(','),
      maxResults: String(PAGE_SIZE),
    });

    const body = await googleFetch<VideoListResponse>({
      url: `${BASE}/videos?${params.toString()}`,
      accessToken,
      api: API,
    });

    for (const item of body.items ?? []) {
      if (!item.id) continue;
      const durationSeconds = parseIsoDuration(item.contentDetails?.duration);
      const thumbnails = item.snippet?.thumbnails ?? {};

      results.push({
        youtubeVideoId: item.id,
        title: item.snippet?.title ?? '',
        description: item.snippet?.description ?? '',
        thumbnailUrl:
          thumbnails.maxres?.url ??
          thumbnails.standard?.url ??
          thumbnails.high?.url ??
          thumbnails.medium?.url ??
          null,
        publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
        durationSeconds,
        privacyStatus: normalisePrivacy(item.status?.privacyStatus),
        url: `https://www.youtube.com/watch?v=${item.id}`,
        // Shorts have no authoritative flag on this resource, so the
        // classification records that it was inferred from duration.
        classification: classifyVideo({
          durationSeconds,
          isLiveBroadcast: Boolean(item.liveStreamingDetails),
        }),
      });
    }
  }

  return results;
}

function normalisePrivacy(value: string | undefined): PrivacyStatus {
  if (value === 'public' || value === 'unlisted' || value === 'private') return value;
  return 'unknown';
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
