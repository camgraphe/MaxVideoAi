import { normalizeGa4SessionId } from '@/lib/analytics/ga-session-id';

const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ??
  process.env.NEXT_PUBLIC_GA4_ID ??
  '';

type Ga4Getter = (
  command: 'get',
  measurementId: string,
  field: 'session_id',
  callback: (value: unknown) => void,
) => void;

type ReadGa4SessionIdOptions = {
  gtag?: Ga4Getter | null;
  measurementId?: string;
  timeoutMs?: number;
};

export async function readGa4SessionId({
  gtag =
    typeof window === 'undefined'
      ? null
      : ((window as typeof window & { gtag?: Ga4Getter }).gtag ?? null),
  measurementId = GA_ID,
  timeoutMs = 400,
}: ReadGa4SessionIdOptions = {}): Promise<string | null> {
  if (!gtag || !measurementId) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(normalizeGa4SessionId(value));
    };
    const timeoutId = setTimeout(() => finish(null), Math.max(0, timeoutMs));

    try {
      gtag('get', measurementId, 'session_id', finish);
    } catch {
      finish(null);
    }
  });
}
