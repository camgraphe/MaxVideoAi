import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { getMcpRequestHost } from '@/lib/mcp-host-routing';
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
  if (claimsError || !claimsData?.claims?.sub) {
    redirect(buildConsentLoginPath(authorizationId));
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return <InvalidAuthorizationRequest />;
  }
  if (!('authorization_id' in data)) {
    redirect(resolveOAuthRedirectUrl(data.redirect_url));
  }

  return (
    <OAuthConsentForm
      authorizationId={data.authorization_id}
      clientName={data.client.name}
      clientUri={data.client.uri}
      redirectUri={data.redirect_uri}
      scopes={data.scope.split(/\s+/).filter(Boolean)}
    />
  );
}
