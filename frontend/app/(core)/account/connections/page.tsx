import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { query } from '@/lib/db';
import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';
import { listMcpActivityHistory } from '@/server/agent-api/activity-history';
import { getMcpSpendingSettings } from '@/server/agent-api/spending-limits';
import { isMcpFoundationFeatureEnabled } from '@/server/mcp/feature-access';
import {
  McpConnectionsClient,
  type McpConnectionGrant,
} from './_components/McpConnectionsClient';
import { McpSpendingControls } from './_components/McpSpendingControls';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Connected applications', robots: { index: false, follow: false } };

export default async function McpConnectionsPage() {
  const requestHeaders = await headers();
  const requestHost = getMcpRequestHost(requestHeaders);
  if (!isMcpFoundationFeatureEnabled('oauth', process.env, requestHost)) notFound();

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
  const clientLabels = Object.fromEntries(
    grants.map((grant) => [grant.clientId, grant.clientName]),
  );
  const [settingsResult, activityResult] = await Promise.allSettled([
    getMcpSpendingSettings(userData.user.id, { executor: { query } }),
    listMcpActivityHistory({ userId: userData.user.id, clientLabels }),
  ]);
  const settingsUnavailable = settingsResult.status === 'rejected';
  const activityUnavailable = activityResult.status === 'rejected';
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
  const activity = activityResult.status === 'fulfilled' ? activityResult.value : [];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-w-0 flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mx-auto max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Account security</p>
            <h1 className="mt-2 text-2xl font-semibold text-text-primary">Connected applications</h1>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Review applications allowed to access MaxVideoAI. Disconnecting an application ends its access and requires a new approval before it can reconnect.
            </p>
            <div className="mt-6">
              <McpSpendingControls
                initialSettings={settings}
                initialActivity={activity}
                settingsUnavailable={settingsUnavailable}
                activityUnavailable={activityUnavailable}
              />
            </div>
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
