import { BillingClient } from './_components/BillingClient';
import { DEFAULT_BILLING_INTENT } from './_lib/billing-intent';
import { resolveMcpTopupBillingIntent } from '@/server/agent-api/topup-handoff';

export const dynamic = 'force-dynamic';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawToken = (await searchParams).mcp_topup;
  const hasMcpToken = rawToken !== undefined;
  const signed = resolveMcpTopupBillingIntent(
    Array.isArray(rawToken) ? null : rawToken,
    { secret: process.env.MCP_TOPUP_HANDOFF_SECRET },
  );
  return <BillingClient
    initialBillingIntent={signed?.billingIntent ?? (hasMcpToken ? DEFAULT_BILLING_INTENT : null)}
    signedLoginRedirectTarget={signed?.loginRedirectTarget ?? null}
  />;
}
