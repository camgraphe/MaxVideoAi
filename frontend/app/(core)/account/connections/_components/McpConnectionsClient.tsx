'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Cable, CheckCircle2, PlugZap } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabaseClient';

export type McpConnectionGrant = {
  clientId: string;
  clientName: string;
  clientUri: string;
  scopes: string[];
  grantedAt: string;
};

const CONNECTION_BRANDS = {
  openai: {
    light: '/brand/partners/openai/openai-mark-light.svg',
    dark: '/brand/partners/openai/openai-mark-dark.svg',
  },
  anthropic: {
    light: '/brand/partners/anthropic/claude-mark-light.svg',
    dark: '/brand/partners/anthropic/claude-mark-dark.svg',
  },
} as const;

export function resolveConnectionBrand(grant: Pick<McpConnectionGrant, 'clientName' | 'clientUri'>) {
  const identity = `${grant.clientName} ${grant.clientUri}`.toLowerCase();
  if (/claude|anthropic/u.test(identity)) return CONNECTION_BRANDS.anthropic;
  if (/chatgpt|openai|codex/u.test(identity)) return CONNECTION_BRANDS.openai;
  return null;
}

function ConnectionMark({ grant }: { grant: McpConnectionGrant }) {
  const brand = resolveConnectionBrand(grant);
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border bg-bg shadow-sm" aria-hidden>
      {brand ? <>
        <Image src={brand.light} alt="" width={26} height={26} className="h-6 w-6 object-contain dark:hidden" />
        <Image src={brand.dark} alt="" width={26} height={26} className="hidden h-6 w-6 object-contain dark:block" />
      </> : <Cable className="h-6 w-6 text-text-secondary" />}
    </span>
  );
}

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
      <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center shadow-card sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden>
          <PlugZap className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-text-primary">No connected applications</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text-secondary">
          ChatGPT, Claude, Codex, and other compatible clients will appear here after you approve access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-input border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
      {grants.map((grant) => (
        <article key={grant.clientId} className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <div className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
            <div className="flex min-w-0 gap-4">
              <ConnectionMark grant={grant} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-text-primary">{grant.clientName}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> Connected
                  </span>
                </div>
                {grant.clientUri ? <p className="mt-1 truncate text-sm text-text-muted" title={grant.clientUri}>{grant.clientUri}</p> : null}
                <p className="mt-2 text-xs text-text-muted">
                  Approved {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(grant.grantedAt))}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled={pendingClientId === grant.clientId} onClick={() => void disconnect(grant.clientId)} className="w-full shrink-0 sm:w-auto">
              {pendingClientId === grant.clientId ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
          <div className="border-t border-border bg-bg/60 px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Permissions</p>
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Granted permissions">
              {grant.scopes.map((scope) => (
                <span key={scope} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary">{scope}</span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
