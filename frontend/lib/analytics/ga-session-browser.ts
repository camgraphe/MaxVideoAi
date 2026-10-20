import { normalizeGa4SessionId } from '@/lib/analytics/ga-session-id';
import { hasAnalyticsConsentInBrowser } from './consent-client';
import { isBrowserCommercialAnalyticsExcluded } from './commercial-client';

const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ??
  process.env.NEXT_PUBLIC_GA4_ID ??
  '';

type Ga4Field = 'client_id' | 'session_id';

type Ga4Getter = (
  command: 'get',
  measurementId: string,
  field: Ga4Field,
  callback: (value: unknown) => void,
) => void;

type ReadGa4FieldOptions = {
  gtag?: Ga4Getter | null;
  getGtag?: () => Ga4Getter | null;
  canRead?: () => boolean;
  measurementId?: string;
  timeoutMs?: number;
  onDiagnostic?: (status: Ga4CheckoutDiagnostic) => void;
};

export type Ga4CheckoutDiagnostic =
  | 'complete' | 'client_missing' | 'session_missing' | 'identifiers_missing'
  | 'tag_unavailable' | 'measurement_unconfigured' | 'consent_or_role_excluded';

function canReadBrowserTag(): boolean {
  return typeof window === 'undefined'
    || (hasAnalyticsConsentInBrowser() && !isBrowserCommercialAnalyticsExcluded());
}

function browserGtag(): Ga4Getter | null {
  return typeof window === 'undefined' ? null : ((window as typeof window & { gtag?: Ga4Getter }).gtag ?? null);
}

function normalizeGa4ClientId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^\d+\.\d+$/.test(normalized) ? normalized : null;
}

async function readGa4Field(
  field: Ga4Field,
  normalize: (value: unknown) => string | null,
  {
    gtag,
    getGtag = gtag !== undefined ? () => gtag : browserGtag,
    canRead = canReadBrowserTag,
    measurementId = GA_ID,
    timeoutMs = 400,
  }: ReadGa4FieldOptions = {},
): Promise<string | null> {
  if (!measurementId || !canRead()) return null;
  if (gtag === null && !getGtag()) return null;

  return new Promise((resolve) => {
    let settled = false;
    let retryId: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      clearTimeout(retryId);
      resolve(canRead() ? normalize(value) : null);
    };
    const timeoutId = setTimeout(() => finish(null), Math.max(0, timeoutMs));

    const attempt = () => {
      if (settled) return;
      if (!canRead()) { finish(null); return; }
      try {
        const tag = getGtag();
        if (tag) tag('get', measurementId, field, finish);
        else retryId = setTimeout(attempt, 25);
      } catch { finish(null); }
    };
    attempt();
  });
}

export function readGa4ClientId(options: ReadGa4FieldOptions = {}): Promise<string | null> {
  return readGa4Field('client_id', normalizeGa4ClientId, options);
}

export async function readGa4SessionId({
  ...options
}: ReadGa4FieldOptions = {}): Promise<string | null> {
  return readGa4Field('session_id', normalizeGa4SessionId, options);
}

export async function readGa4CheckoutContext(
  options: ReadGa4FieldOptions = {},
): Promise<{ clientId: string | null; sessionId: string | null }> {
  let sawTag = false;
  const canRead = options.canRead ?? canReadBrowserTag;
  const getTag = options.getGtag ?? (options.gtag !== undefined ? () => options.gtag ?? null : browserGtag);
  const guardedOptions = { ...options, canRead, getGtag: () => {
    const tag = getTag();
    if (tag) sawTag = true;
    return tag;
  } };
  const [readClientId, readSessionId] = await Promise.all([
    readGa4ClientId(guardedOptions),
    readGa4SessionId(guardedOptions),
  ]);
  const eligible = canRead();
  const clientId = eligible ? readClientId : null;
  const sessionId = eligible ? readSessionId : null;
  const diagnostic: Ga4CheckoutDiagnostic = !eligible ? 'consent_or_role_excluded'
    : !(options.measurementId ?? GA_ID) ? 'measurement_unconfigured'
      : !sawTag ? 'tag_unavailable'
        : clientId && sessionId ? 'complete'
          : clientId ? 'session_missing' : sessionId ? 'client_missing' : 'identifiers_missing';
  try { options.onDiagnostic?.(diagnostic); } catch { /* Diagnostics cannot block payment. */ }
  return { clientId, sessionId };
}
