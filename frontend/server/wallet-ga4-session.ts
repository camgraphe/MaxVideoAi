import { normalizeGa4SessionId } from '@/lib/analytics/ga-session-id';
import { extractGaClientId } from '@/server/ga4';

type WalletGa4CheckoutContextInput = {
  analyticsConsentGranted: boolean;
  gaClientCookie: string | null;
  gaSessionId: unknown;
};

export function resolveWalletGa4CheckoutContext({
  analyticsConsentGranted,
  gaClientCookie,
  gaSessionId,
}: WalletGa4CheckoutContextInput): {
  metadata: Record<string, string>;
  sessionId: string | null;
} {
  if (!analyticsConsentGranted) return { metadata: {}, sessionId: null };

  const clientId = extractGaClientId(gaClientCookie);
  const sessionId = normalizeGa4SessionId(gaSessionId);
  return {
    metadata: {
      ...(clientId ? { ga_client_id: clientId } : {}),
      ...(sessionId ? { ga_session_id: sessionId } : {}),
    },
    sessionId,
  };
}
