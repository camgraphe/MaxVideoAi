import { SITE_BASE_URL } from '@/lib/metadataUrls';

const API_PATH = '/api/indexnow';

function resolveApiEndpoint() {
  if (typeof window !== 'undefined') {
    return API_PATH;
  }
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : SITE_BASE_URL);
  return `${base.replace(/\/+$/, '')}${API_PATH}`;
}

function normalizeSubmissionUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const normalized = url.startsWith('/') ? url : `/${url}`;
  return `${SITE_BASE_URL.replace(/\/+$/, '')}${normalized}`;
}

export async function submitToIndexNow(url: string | null | undefined) {
  if (!url || typeof url !== 'string') {
    return;
  }
  if (!process.env.INDEXNOW_KEY) {
    return;
  }
  const endpoint = resolveApiEndpoint();
  const target = normalizeSubmissionUrl(url);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: target }),
      cache: 'no-store',
    });
    if (!response.ok && process.env.NODE_ENV !== 'production') {
      const detail = await response.text().catch(() => null);
      console.warn(`[indexnow] submission failed for ${target}`, detail ?? response.statusText);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[indexnow] submission error', error);
    }
  }
}
