import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { isMcpFoundationFeatureEnabled } from '@/server/mcp/feature-access';
import {
  McpConnectionsClient,
  type McpConnectionGrant,
} from './_components/McpConnectionsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connected applications', robots: { index: false, follow: false } };

export default async function McpConnectionsPage() {
  if (!isMcpFoundationFeatureEnabled('oauth')) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect('/login?next=%2Faccount%2Fconnections');
  }

  const { data, error } = await supabase.auth.oauth.listGrants();
  const grants: McpConnectionGrant[] = (data ?? []).map((grant) => ({
    clientId: grant.client.id,
    clientName: grant.client.name,
    clientUri: grant.client.uri,
    scopes: grant.scopes,
    grantedAt: grant.granted_at,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-w-0 flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Account security</p>
            <h1 className="mt-2 text-2xl font-semibold text-text-primary">Connected applications</h1>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Review applications allowed to access MaxVideoAI. Disconnecting an application ends its access and requires a new approval before it can reconnect.
            </p>
            {error ? (
              <p className="mt-6 rounded-input border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                Unable to load connected applications right now.
              </p>
            ) : (
              <div className="mt-6">
                <McpConnectionsClient initialGrants={grants} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
