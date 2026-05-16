import { NextRequest, NextResponse } from 'next/server';
import { runGoogleVertexVeoPoll } from '@/server/google-vertex-veo-poll';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const POLL_TOKEN = (process.env.GOOGLE_VERTEX_VEO_POLL_TOKEN ?? '').trim();

function unauthorized(reason: string, req: NextRequest) {
  console.warn('[cron-google-vertex-veo-poll] unauthorized', {
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

async function triggerPoll(req: NextRequest) {
  const auth = authorizeCronRequest(req.headers, {
    cronSecret: CRON_SECRET,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    localTokens: [POLL_TOKEN],
    overrideHeaderName: 'x-google-vertex-veo-poll-token',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) {
    return unauthorized(auth.reason, req);
  }

  try {
    return await runGoogleVertexVeoPoll();
  } catch (error) {
    console.error('[cron-google-vertex-veo-poll] failed to run poll', error);
    return NextResponse.json({ ok: false, error: 'Failed to run Google Veo direct poll' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return triggerPoll(req);
}

export async function POST(req: NextRequest) {
  return triggerPoll(req);
}
