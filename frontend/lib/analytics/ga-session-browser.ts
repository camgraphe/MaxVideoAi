import { normalizeGa4SessionId } from '@/lib/analytics/ga-session-id';

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
  measurementId?: string;
  timeoutMs?: number;
};

function normalizeGa4ClientId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^\d+\.\d+$/.test(normalized) ? normalized : null;
}

async function readGa4Field(
  field: Ga4Field,
  normalize: (value: unknown) => string | null,
  {
    gtag =
      typeof window === 'undefined'
        ? null
        : ((window as typeof window & { gtag?: Ga4Getter }).gtag ?? null),
    measurementId = GA_ID,
    timeoutMs = 400,
  }: ReadGa4FieldOptions = {},
): Promise<string | null> {
  if (!gtag || !measurementId) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(normalize(value));
    };
    const timeoutId = setTimeout(() => finish(null), Math.max(0, timeoutMs));

    try {
      gtag('get', measurementId, field, finish);
    } catch {
      finish(null);
    }
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
  const [clientId, sessionId] = await Promise.all([
    readGa4ClientId(options),
    readGa4SessionId(options),
  ]);
  return { clientId, sessionId };
}
