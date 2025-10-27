import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const POLL_TOKEN = (process.env.FAL_POLL_TOKEN ?? '').trim();

async function triggerPoll(req: NextRequest) {
  if (process.env.VERCEL === '1') {
    const cronHeader = req.headers.get('x-vercel-cron');
    const deploymentId = (process.env.VERCEL_DEPLOYMENT_ID ?? '').trim();
    const incomingDeploymentId = (req.headers.get('x-vercel-deployment-id') ?? '').trim();
    if (!cronHeader) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (deploymentId && incomingDeploymentId && deploymentId !== incomingDeploymentId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
  } else {
    const overrideToken =
      req.headers.get('x-fal-poll-token') ??
      (req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
    if (overrideToken !== POLL_TOKEN) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  if (!POLL_TOKEN) {
    return NextResponse.json({ ok: false, error: 'FAL_POLL_TOKEN is not configured' }, { status: 500 });
  }

  const pollUrl = new URL('/api/fal/poll', req.nextUrl.origin);

  try {
    const res = await fetch(pollUrl.toString(), {
      method: 'POST',
      headers: {
        'X-Fal-Poll-Token': POLL_TOKEN,
      },
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') ?? 'application/json';
    const bodyText = await res.text();

    return new NextResponse(bodyText, {
      status: res.status,
      headers: { 'content-type': contentType },
    });
  } catch (error) {
    console.error('[cron-fal-poll] failed to trigger poll', error);
    return NextResponse.json({ ok: false, error: 'Failed to trigger Fal poll' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return triggerPoll(req);
}

export async function POST(req: NextRequest) {
  return triggerPoll(req);
}
