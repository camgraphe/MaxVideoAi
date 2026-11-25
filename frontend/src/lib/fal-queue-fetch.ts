import { ENV } from '@/lib/env';

const FAL_QUEUE_ORIGIN = 'https://queue.fal.run';
const FAL_QUEUE_READ_PATH = /^(?:\/[\w.-]+){2,}\/requests\/[\w-]+(?:\/status)?$/u;

/** The request ID belongs to an account. During a cutover, the other account may return 404. */
export function createFalQueueReadFetch(
  fetcher: typeof fetch = fetch,
  { primary, fallback } = { primary: ENV.FAL_API_KEY, fallback: ENV.FAL_QUEUE_READ_FALLBACK_KEY },
): typeof fetch {
  if (!primary || !fallback || primary === fallback) return fetcher;

  return async (input, init) => {
    const response = await fetcher(input, init);
    if (response.status !== 404) return response;

    const request = input instanceof Request ? input : undefined;
    const method = init?.method ?? request?.method ?? 'GET';
    if (method.toUpperCase() !== 'GET') return response;

    const headers = new Headers(init?.headers ?? request?.headers);
    if (headers.get('Authorization') !== `Key ${primary}`) return response;

    const address = request?.url ?? String(input);
    if (!URL.canParse(address)) return response;
    const url = new URL(address);
    if (url.origin !== FAL_QUEUE_ORIGIN || url.username || url.password || url.hash ||
      !FAL_QUEUE_READ_PATH.test(url.pathname)) return response;

    headers.set('Authorization', `Key ${fallback}`);
    const retry = new Request(input, { ...init, headers, redirect: 'error' });
    void response.body?.cancel().catch(() => undefined);
    return fetcher(retry);
  };
}
