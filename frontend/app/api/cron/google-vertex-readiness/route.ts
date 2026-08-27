import { NextRequest, NextResponse } from 'next/server';

import { runGoogleVertexReadinessProbe } from '@/server/google-vertex-readiness';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const POLL_TOKEN = (process.env.GOOGLE_VERTEX_VEO_POLL_TOKEN ?? '').trim();

function unauthorized(reason: string) {
  console.warn('[cron-google-vertex-readiness] unauthorized', { reason });
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
}

async function runReadiness(req: NextRequest) {
  const auth = authorizeCronRequest(req.headers, {
    cronSecret: CRON_SECRET,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    localTokens: [POLL_TOKEN],
    overrideHeaderName: 'x-google-vertex-veo-poll-token',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) return unauthorized(auth.reason);

  try {
    const result = await runGoogleVertexReadinessProbe();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, error: 'GOOGLE_VERTEX_READINESS_FAILED' }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  return runReadiness(req);
}

export async function POST(req: NextRequest) {
  return runReadiness(req);
}
