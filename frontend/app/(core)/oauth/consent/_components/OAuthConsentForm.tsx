import { Button } from '@/components/ui/Button';
import { MCP_OAUTH_CONSENT_COPY as copy } from '../_lib/consent-copy';

type OAuthConsentFormProps = {
  authorizationId: string;
  connectionBindingToken?: string | null;
  clientName: string;
  clientUri: string;
  redirectUri: string;
  scopes: string[];
};

export function OAuthConsentForm({
  authorizationId,
  connectionBindingToken,
  clientName,
  clientUri,
  redirectUri,
  scopes,
}: OAuthConsentFormProps) {
  return (
    <main className="container-page flex min-h-screen max-w-2xl items-center py-12">
      <section className="w-full rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">{copy.description}</p>

        <div className="mt-6 rounded-card border border-border bg-bg p-4">
          <h2 className="text-lg font-semibold text-text-primary">{clientName}</h2>
          {clientUri ? <p className="mt-1 break-all text-sm text-text-muted">{clientUri}</p> : null}
          <h3 className="mt-4 text-sm font-semibold text-text-primary">{copy.permissionsTitle}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
            {scopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-text-muted">
            {copy.redirectLabel}: <span className="break-all font-mono">{redirectUri}</span>
          </p>
        </div>

        <form action="/api/oauth/decision" method="post" className="mt-6 flex flex-wrap gap-3">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          {connectionBindingToken ? (
            <input type="hidden" name="mcp_binding" value={connectionBindingToken} />
          ) : null}
          <Button type="submit" name="decision" value="approve">
            {copy.approve}
          </Button>
          <Button type="submit" name="decision" value="deny" variant="outline">
            {copy.deny}
          </Button>
        </form>
      </section>
    </main>
  );
}
