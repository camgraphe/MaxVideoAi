import { listAngleToolEngines } from '@/config/tools-angle-engines';
import { listFalEngines } from '@/config/falEngines';

const DISALLOWED_FAL_MODELS = ['beatoven/music-generation'] as const;
const ALLOWED_FAL_PROXY_HOSTS = new Set([
  'queue.fal.run',
  'fal.run',
  'rest.fal.ai',
]);
const ALLOWED_FAL_STORAGE_PATHS = new Set(['/storage/upload/initiate', '/storage/upload/initiate-multipart']);
const EXTRA_FAL_PROXY_ENDPOINTS = [
  'fal-ai/thinksound/audio',
  'fal-ai/lyria2',
  'fal-ai/minimax/speech-2.8-hd',
  'fal-ai/minimax/speech-02-hd',
  'fal-ai/minimax/voice-clone',
] as const;

export const FAL_PROXY_ALLOWED_ENDPOINTS = Array.from(
  new Set([
    ...listFalEngines().flatMap((engine) => [
      engine.defaultFalModelId,
      ...engine.modes.map((mode) => mode.falModelId),
    ]),
    ...listAngleToolEngines().map((engine) => engine.falModelId),
    ...EXTRA_FAL_PROXY_ENDPOINTS,
  ].map(normalizeFalIdentifier))
).sort();
const FAL_PROXY_ALLOWED_ENDPOINT_SET = new Set(FAL_PROXY_ALLOWED_ENDPOINTS);

function normalizeFalIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

function isBlockedFalIdentifier(value: string): boolean {
  const normalized = normalizeFalIdentifier(value);
  return DISALLOWED_FAL_MODELS.some((blocked) => normalized === blocked || normalized.includes(`/${blocked}`));
}

export function assertFalModelAllowed(model: string): void {
  if (isBlockedFalIdentifier(model)) {
    throw new Error(`Fal model "${model}" is blocked by policy.`);
  }
}

function extractFalEndpointFromPath(pathname: string): string {
  const normalized = normalizeFalIdentifier(pathname);
  const requestMarker = '/requests/';
  const requestIndex = normalized.indexOf(requestMarker);
  if (requestIndex >= 0) {
    return normalized.slice(0, requestIndex);
  }
  return normalized;
}

function isAllowedStorageTarget(parsed: URL): boolean {
  return (
    parsed.hostname.toLowerCase() === 'rest.fal.ai' &&
    ALLOWED_FAL_STORAGE_PATHS.has(parsed.pathname) &&
    parsed.searchParams.get('storage_type') === 'fal-cdn-v3'
  );
}

export function isFalProxyTargetAllowed(targetUrl: string | null | undefined): boolean {
  if (!targetUrl || !targetUrl.trim()) {
    return true;
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:' || !ALLOWED_FAL_PROXY_HOSTS.has(parsed.hostname.toLowerCase())) {
      return false;
    }

    if (parsed.hostname.toLowerCase() === 'rest.fal.ai') {
      return isAllowedStorageTarget(parsed);
    }

    const endpoint = extractFalEndpointFromPath(parsed.pathname);
    if (!FAL_PROXY_ALLOWED_ENDPOINT_SET.has(endpoint) || isBlockedFalIdentifier(endpoint)) {
      return false;
    }

    for (const [key, value] of parsed.searchParams.entries()) {
      if (key.toLowerCase().includes('endpoint') || key.toLowerCase().includes('model')) {
        const queryEndpoint = normalizeFalIdentifier(value);
        if (!FAL_PROXY_ALLOWED_ENDPOINT_SET.has(queryEndpoint) || isBlockedFalIdentifier(queryEndpoint)) {
          return false;
        }
      }
    }

    const decodedTarget = decodeURIComponent(`${parsed.pathname}?${parsed.search}`);
    return !isBlockedFalIdentifier(decodedTarget);
  } catch {
    return false;
  }
}
