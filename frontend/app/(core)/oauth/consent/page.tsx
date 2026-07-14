import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  MCP_ACQUISITION_COOKIE_NAME,
  resolveMcpAcquisitionSigningSecret,
  verifySignedMcpAcquisitionCookie,
} from '@/lib/mcp-acquisition';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { createMcpOAuthApprovalBinding } from '@/server/agent-api/mcp-funnel';
import {
  buildConsentLoginPath,
  isValidAuthorizationId,
  resolveOAuthRedirectUrl,
} from '@/server/mcp/oauth-consent';
import { isMcpFoundationFeatureEnabled } from '@/server/mcp/feature-access';
import { OAuthConsentForm } from './_components/OAuthConsentForm';
import { MCP_OAUTH_CONSENT_COPY as copy } from './_lib/consent-copy';

export const dynamic = 'force-dynamic';

type ConsentPageProps = {
  searchParams: Promise<{ authorization_id?: string | string[] }>;
};

function InvalidAuthorizationRequest() {
  return (
    <main className="container-page flex min-h-screen max-w-xl items-center py-12">
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold text-text-primary">{copy.invalidTitle}</h1>
        <p className="mt-3 text-sm text-text-secondary">{copy.invalidDescription}</p>
      </section>
    </main>
  );
}

export default async function OAuthConsentPage({ searchParams }: ConsentPageProps) {
  const requestHeaders = await headers();
  const requestHost = getMcpRequestHost(requestHeaders);
  if (!isMcpFoundationFeatureEnabled('oauth', process.env, requestHost)) notFound();

  const params = await searchParams;
  const authorizationId = params.authorization_id;
  if (!isValidAuthorizationId(authorizationId)) {
    return <InvalidAuthorizationRequest />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const subject = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub.trim() : '';
  if (claimsError || !subject) {
    redirect(buildConsentLoginPath(authorizationId));
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user || user.id !== subject) {
    redirect(buildConsentLoginPath(authorizationId));
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return <InvalidAuthorizationRequest />;
  }
  if (!('authorization_id' in data)) {
    redirect(resolveOAuthRedirectUrl(data.redirect_url));
  }

  const cookieStore = await cookies();
  const signedCookie = cookieStore.get(MCP_ACQUISITION_COOKIE_NAME)?.value;
  let connectionBindingToken: string | null = null;
  if (signedCookie) {
    try {
      const secret = resolveMcpAcquisitionSigningSecret();
      const acquisition = verifySignedMcpAcquisitionCookie(signedCookie, { secret });
      if (acquisition) {
        connectionBindingToken = await createMcpOAuthApprovalBinding({
          authorizationId,
          userId: user.id,
          oauthClientId: data.client.id,
          acquisition,
        }, { secret });
      }
    } catch {
      connectionBindingToken = null;
    }
  }

  return (
    <OAuthConsentForm
      authorizationId={data.authorization_id}
      connectionBindingToken={connectionBindingToken}
      clientName={data.client.name}
      clientUri={data.client.uri}
      redirectUri={data.redirect_uri}
      scopes={data.scope.split(/\s+/).filter(Boolean)}
    />
  );
}
