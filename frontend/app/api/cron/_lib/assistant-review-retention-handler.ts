import type { NextRequest } from 'next/server';
import { authorizeCronRequest } from '@/server/vercel-cron';
import { cleanupAssistantReviewContext, type ReviewRetentionResult } from '@/server/admin-assistant-review/retention';

export async function handleAssistantReviewRetentionCron(req: NextRequest, dependencies: { env?: NodeJS.ProcessEnv; run?: () => Promise<ReviewRetentionResult> } = {}) {
  const env = dependencies.env ?? process.env;
  if (!env.CRON_SECRET?.trim() || !authorizeCronRequest(req.headers, { cronSecret: env.CRON_SECRET, vercelEnv: env.VERCEL, deploymentId: env.VERCEL_DEPLOYMENT_ID }).ok) {
    return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const result = await (dependencies.run ?? cleanupAssistantReviewContext)();
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ ok: false, error: 'REVIEW_RETENTION_UNAVAILABLE' }, { status: 503 });
  }
}
