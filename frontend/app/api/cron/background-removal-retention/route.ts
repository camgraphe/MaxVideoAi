import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredBackgroundRemovalProResAssets } from '@/server/tools/background-removal-retention-cleanup';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const RETENTION_TOKEN = (process.env.BACKGROUND_REMOVAL_RETENTION_TOKEN ?? '').trim();

function unauthorized(reason: string, req: NextRequest) {
  console.warn('[background-removal-retention] unauthorized', {
    reason,
    cron: req.headers.get('x-vercel-cron') || null,
    ua: req.headers.get('user-agent') || null,
    deployment: req.headers.get('x-vercel-deployment-id') || null,
    source: req.headers.get('x-vercel-source') || null,
  });
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
}

async function triggerCleanup(req: NextRequest) {
  const auth = authorizeCronRequest(req.headers, {
    cronSecret: CRON_SECRET,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    localTokens: [RETENTION_TOKEN],
    overrideHeaderName: 'x-background-removal-retention-token',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) {
    return unauthorized(auth.reason, req);
  }

  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '');
  const result = await cleanupExpiredBackgroundRemovalProResAssets({
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : null,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}

export async function GET(req: NextRequest) {
  return triggerCleanup(req);
}

export async function POST(req: NextRequest) {
  return triggerCleanup(req);
}
