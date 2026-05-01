import { NextRequest, NextResponse } from 'next/server';
import { runBytePlusPoll } from '@/server/byteplus-poll';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const POLL_TOKEN = (process.env.BYTEPLUS_POLL_TOKEN ?? '').trim();

function unauthorized(reason: string, req: NextRequest) {
  console.warn('[cron-byteplus-poll] unauthorized', {
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
    overrideHeaderName: 'x-byteplus-poll-token',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) {
    return unauthorized(auth.reason, req);
  }

  console.log('[cron-byteplus-poll] triggering BytePlus poll', {
    env: process.env.VERCEL === '1' ? 'vercel' : 'local',
    authMode: auth.mode,
    hasCronHeader: Boolean(req.headers.get('x-vercel-cron')),
    cronSecretConfigured: Boolean(CRON_SECRET),
    pollTokenConfigured: Boolean(POLL_TOKEN),
  });

  try {
    return await runBytePlusPoll();
  } catch (error) {
    console.error('[cron-byteplus-poll] failed to run poll', error);
    return NextResponse.json({ ok: false, error: 'Failed to run BytePlus poll' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return triggerPoll(req);
}

export async function POST(req: NextRequest) {
  return triggerPoll(req);
}
