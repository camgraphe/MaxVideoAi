import { NextRequest, NextResponse } from 'next/server';
import { runLumaAgentsPoll } from '@/server/luma-agents-poll';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const POLL_TOKEN = (process.env.LUMA_AGENTS_POLL_TOKEN ?? '').trim();

function unauthorized(reason: string, req: NextRequest) {
  console.warn('[cron-luma-agents-poll] unauthorized', {
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
    overrideHeaderName: 'x-luma-agents-poll-token',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) {
    return unauthorized(auth.reason, req);
  }

  try {
    return await runLumaAgentsPoll();
  } catch (error) {
    console.error('[cron-luma-agents-poll] failed to run poll', error);
    return NextResponse.json({ ok: false, error: 'Failed to run Luma Agents direct poll' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return triggerPoll(req);
}

export async function POST(req: NextRequest) {
  return triggerPoll(req);
}
