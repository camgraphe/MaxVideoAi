type HeaderReader = Pick<Headers, 'get'>;

type CronAuthOptions = {
  cronSecret?: string | null | undefined;
  deploymentId?: string | null | undefined;
  localTokens?: Array<string | null | undefined>;
  overrideHeaderName?: string;
  vercelEnv?: string | null | undefined;
};

type CronAuthSuccessMode = 'local-no-secret' | 'local-token' | 'vercel-fallback' | 'vercel-secret';

export type CronAuthResult =
  | { ok: true; mode: CronAuthSuccessMode }
  | { ok: false; reason: string };

function normalizeValue(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function extractToken(value: string | null | undefined): string {
  const normalized = normalizeValue(value);
  if (!normalized) return '';
  return normalized.replace(/^Bearer\s+/i, '').trim();
}

export function authorizeCronRequest(headers: HeaderReader, options: CronAuthOptions): CronAuthResult {
  const cronSecret = extractToken(options.cronSecret);
  const localTokens = (options.localTokens ?? []).map(extractToken).filter(Boolean);
  const overrideToken = extractToken(options.overrideHeaderName ? headers.get(options.overrideHeaderName) : null);
  const authorizationToken = extractToken(headers.get('authorization'));
  const providedToken = overrideToken || authorizationToken;
  const vercelEnv = normalizeValue(options.vercelEnv);
  const deploymentId = normalizeValue(options.deploymentId);
  const incomingDeploymentId = normalizeValue(headers.get('x-vercel-deployment-id'));

  if (vercelEnv === '1') {
    if (deploymentId && incomingDeploymentId && incomingDeploymentId !== deploymentId) {
      return { ok: false, reason: 'deployment-mismatch' };
    }

    if (cronSecret) {
      return providedToken === cronSecret
        ? { ok: true, mode: 'vercel-secret' }
        : { ok: false, reason: 'missing-cron-secret' };
    }

    // Fallback only when CRON_SECRET is not configured on Vercel.
    const cronHeader = normalizeValue(headers.get('x-vercel-cron'));
    const userAgent = normalizeValue(headers.get('user-agent')).toLowerCase();
    if (cronHeader && userAgent === 'vercel-cron/1.0') {
      return { ok: true, mode: 'vercel-fallback' };
    }

    return { ok: false, reason: 'missing-vercel-cron-markers' };
  }

  if (cronSecret && providedToken === cronSecret) {
    return { ok: true, mode: 'local-token' };
  }

  if (localTokens.some((token) => token === providedToken)) {
    return { ok: true, mode: 'local-token' };
  }

  if (cronSecret || localTokens.length) {
    return { ok: false, reason: 'missing-token' };
  }

  return { ok: true, mode: 'local-no-secret' };
}
