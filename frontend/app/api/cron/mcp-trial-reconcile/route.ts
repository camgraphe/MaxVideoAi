import { reconcileTrialEntitlements } from '@/server/agent-api/reconcile-trial-entitlements';
import { createTrialReconciliationCronHandler } from '@/server/mcp-trial-reconcile-cron';

export const runtime = 'nodejs';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const MCP_TRIAL_RECONCILE_TOKEN = (process.env.MCP_TRIAL_RECONCILE_TOKEN ?? '').trim();

const handleTrialReconciliation = createTrialReconciliationCronHandler({
  env: {
    CRON_SECRET,
    MCP_TRIAL_RECONCILE_TOKEN,
    VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID,
    VERCEL: process.env.VERCEL,
  },
  reconcile: reconcileTrialEntitlements,
  log: (value) => console.info('[mcp-trial-reconcile]', value),
});

export { handleTrialReconciliation as GET, handleTrialReconciliation as POST };
