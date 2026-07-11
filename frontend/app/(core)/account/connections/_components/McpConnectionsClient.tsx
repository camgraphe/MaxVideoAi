'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabaseClient';

export type McpConnectionGrant = {
  clientId: string;
  clientName: string;
  clientUri: string;
  scopes: string[];
  grantedAt: string;
};

export function McpConnectionsClient({ initialGrants }: { initialGrants: McpConnectionGrant[] }) {
  const router = useRouter();
  const [grants, setGrants] = useState(initialGrants);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function disconnect(clientId: string) {
    setPendingClientId(clientId);
    setError(null);
    const { error: revokeError } = await supabase.auth.oauth.revokeGrant({ clientId });
    if (revokeError) {
      setError('Unable to disconnect this application. Please try again.');
      setPendingClientId(null);
      return;
    }
    setGrants((current) => current.filter((grant) => grant.clientId !== clientId));
    setPendingClientId(null);
    router.refresh();
  }

  if (!grants.length) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">No connected applications</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Codex, Claude, and other compatible clients will appear here after you approve access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-input border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
      {grants.map((grant) => (
        <article key={grant.clientId} className="rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-text-primary">{grant.clientName}</h2>
              {grant.clientUri ? <p className="mt-1 break-all text-sm text-text-muted">{grant.clientUri}</p> : null}
              <p className="mt-3 text-xs text-text-muted">
                Connected {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(grant.grantedAt))}
              </p>
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Granted permissions">
                {grant.scopes.map((scope) => (
                  <span key={scope} className="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary">
                    {scope}
                  </span>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pendingClientId === grant.clientId}
              onClick={() => void disconnect(grant.clientId)}
            >
              {pendingClientId === grant.clientId ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
