import { YouTubeApiError, kindFromStatus } from './errors';

/** Shared authenticated GET/POST helper for every Google API used here. */
export async function googleFetch<T>(params: {
  url: string;
  accessToken: string;
  api: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}): Promise<T> {
  const response = await fetch(params.url, {
    method: params.method ?? 'GET',
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      accept: 'application/json',
      ...(params.body ? { 'content-type': 'application/json' } : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new YouTubeApiError({
      message: `${params.api} returned ${response.status}: ${await safeReason(response)}`,
      kind: kindFromStatus(response.status),
      status: response.status,
      api: params.api,
    });
  }

  return (await response.json()) as T;
}

/**
 * Google error bodies contain a human-readable reason but can also echo request
 * parameters, so only the short message field is extracted.
 */
async function safeReason(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string; status?: string } };
    return body.error?.message?.slice(0, 200) ?? body.error?.status ?? 'no reason given';
  } catch {
    return 'unparsable error body';
  }
}
