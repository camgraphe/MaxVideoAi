import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/server/vercel-cron';
import { runOpenAIImageOutputRecovery } from '@/server/images/openai-image-output-recovery';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Require the existing shared cron secret; no request body, provider call or DDL.
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !authorizeCronRequest(req.headers, { cronSecret: secret,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID, vercelEnv: process.env.VERCEL }).ok) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try { return NextResponse.json({ ok: true, ...await runOpenAIImageOutputRecovery() }); }
  catch { return NextResponse.json({ ok: false, error: 'IMAGE_RECOVERY_UNAVAILABLE' }, { status: 503 }); }
}
