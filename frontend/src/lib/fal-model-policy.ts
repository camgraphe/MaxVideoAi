const DISALLOWED_FAL_MODELS = ['beatoven/music-generation'] as const;
const ALLOWED_FAL_PROXY_HOSTS = new Set([
  'api.fal.ai',
  'fal.ai',
  'queue.fal.run',
  'fal.run',
]);

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

export function isFalProxyTargetAllowed(targetUrl: string | null | undefined): boolean {
  if (!targetUrl || !targetUrl.trim()) {
    return true;
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:' || !ALLOWED_FAL_PROXY_HOSTS.has(parsed.hostname.toLowerCase())) {
      return false;
    }

    if (isBlockedFalIdentifier(parsed.pathname)) {
      return false;
    }

    for (const [key, value] of parsed.searchParams.entries()) {
      if (key.toLowerCase().includes('endpoint') || key.toLowerCase().includes('model')) {
        if (isBlockedFalIdentifier(value)) {
          return false;
        }
      }
    }

    const decodedTarget = decodeURIComponent(`${parsed.pathname}?${parsed.search}`);
    return !isBlockedFalIdentifier(decodedTarget);
  } catch {
    return !isBlockedFalIdentifier(targetUrl);
  }
}
