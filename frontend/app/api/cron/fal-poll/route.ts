import { NextRequest, NextResponse } from 'next/server';
import { runFalPoll } from '@/server/fal-poll';

export const runtime = 'nodejs';

const POLL_TOKEN = (process.env.FAL_POLL_TOKEN ?? '').trim();

function unauthorized(reason: string, req: NextRequest) {
  const info = {
    reason,
    headers: {
      cron: req.headers.get('x-vercel-cron') || null,
      ua: req.headers.get('user-agent') || null,
      deployment: req.headers.get('x-vercel-deployment-id') || null,
      source: req.headers.get('x-vercel-source') || null,
    },
  };
  console.warn('[cron-fal-poll] unauthorized', info);
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
}

async function triggerPoll(req: NextRequest) {
  const overrideToken =
    req.headers.get('x-fal-poll-token') ??
    (req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');

  if (process.env.VERCEL === '1') {
    const cronHeader = req.headers.get('x-vercel-cron');
    const userAgent = req.headers.get('user-agent') ?? '';
    const deploymentId = (process.env.VERCEL_DEPLOYMENT_ID ?? '').trim();
    const incomingDeploymentId = (req.headers.get('x-vercel-deployment-id') ?? '').trim();

    const looksLikeCron = Boolean(cronHeader || userAgent.toLowerCase().includes('vercel'));

    if (!looksLikeCron && overrideToken !== POLL_TOKEN) {
      return unauthorized('missing-vercel-markers', req);
    }
    if (deploymentId && incomingDeploymentId && deploymentId !== incomingDeploymentId) {
      return unauthorized('deployment-mismatch', req);
    }
  } else {
    if (overrideToken !== POLL_TOKEN) {
      return unauthorized('missing-token', req);
    }
  }

  console.log('[cron-fal-poll] triggering Fal poll', {
    env: process.env.VERCEL === '1' ? 'vercel' : 'local',
    hasCronHeader: Boolean(req.headers.get('x-vercel-cron')),
    ua: req.headers.get('user-agent') ?? null,
    deployment: req.headers.get('x-vercel-deployment-id') ?? null,
    source: req.headers.get('x-vercel-source') ?? null,
    tokenLength: POLL_TOKEN.length,
  });

  if (!POLL_TOKEN) {
    console.warn('[cron-fal-poll] proceeding without FAL_POLL_TOKEN; invoking poll directly');
  }

  try {
    return await runFalPoll();
  } catch (error) {
    console.error('[cron-fal-poll] failed to run poll', error);
    return NextResponse.json({ ok: false, error: 'Failed to run Fal poll' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return triggerPoll(req);
}

export async function POST(req: NextRequest) {
  return triggerPoll(req);
}
