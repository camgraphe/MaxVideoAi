import { NextRequest, NextResponse } from 'next/server';

import { cleanupExpiredReferenceUploadAttempts } from '@/server/agent-api/reference-upload-attempts';
import { deleteStorageObjectKey } from '@/server/storage';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

async function handle(request: NextRequest) {
  const cronSecret = (process.env.CRON_SECRET ?? '').trim();
  if (!cronSecret) return NextResponse.json({ ok: false, error: 'CONFIGURATION_ERROR' }, { status: 503 });
  const auth = authorizeCronRequest(request.headers, {
    cronSecret,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const result = await cleanupExpiredReferenceUploadAttempts({}, { deleteStorageObjectKey });
  return NextResponse.json({ ok: true, ...result });
}

export { handle as GET, handle as POST };
