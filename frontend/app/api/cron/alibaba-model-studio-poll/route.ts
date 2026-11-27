import { NextResponse } from 'next/server';
import { runAlibabaModelStudioPoll } from '@/server/alibaba-model-studio-poll';
import { isWanPilotEnvironment } from '@/server/video-providers/router';
import { reconcileWanPilotWalletStops } from '@/server/wan-pilot-refunds';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const POLL_TOKEN = (process.env.ALIBABA_MODEL_STUDIO_POLL_TOKEN ?? '').trim();

function unauthorized(reason: string, req: Request) {
  console.warn('[cron-alibaba-model-studio-poll] unauthorized', {
    reason,
    headers: {
      cron: req.headers.get('x-vercel-cron') || null,
      ua: req.headers.get('user-agent') || null,
      deployment: req.headers.get('x-vercel-deployment-id') || null,
      source: req.headers.get('x-vercel-source') || null,
    },
  });
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
}

async function triggerPoll(req: Request) {
  const auth = authorizeCronRequest(req.headers, {
    cronSecret: CRON_SECRET,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    localTokens: [POLL_TOKEN],
    overrideHeaderName: 'x-alibaba-model-studio-poll-token',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) return unauthorized(auth.reason, req);

  // Financial recovery runs independently of media polling, including when its preview flags are off.
  const recovery = isWanPilotEnvironment() ? reconcileWanPilotWalletStops().then(result => {
    if (result.errors) console.warn('[wan-purchase] refund reconciliation incomplete', result);
  }).catch(() => console.warn('[wan-purchase] refund reconciliation unavailable')) : undefined;
  try {
    if (!process.env.APIMART_API_KEY?.trim()) return await runAlibabaModelStudioPoll();
    const [alibaba, apimart] = await Promise.all([
      runAlibabaModelStudioPoll(), runAlibabaModelStudioPoll({ provider: 'apimart' }),
    ]);
    return NextResponse.json({ alibaba: await alibaba.json(), apimart: await apimart.json() });
  } catch (error) {
    console.error('[cron-alibaba-model-studio-poll] failed to run poll', error);
    return NextResponse.json({ ok: false, error: 'Failed to run direct video poll' }, { status: 500 });
  } finally {
    await recovery;
  }
}

export async function GET(req: Request) {
  return triggerPoll(req);
}

export async function POST(req: Request) {
  return triggerPoll(req);
}
