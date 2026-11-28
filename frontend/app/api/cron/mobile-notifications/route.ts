import { NextResponse, type NextRequest } from 'next/server';
import { authorizeCronRequest } from '@/server/vercel-cron';
import { drainNotifications } from '@/server/mobile/notifications';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if (
    !authorizeCronRequest(req.headers, {
      cronSecret: secret,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      vercelEnv: process.env.VERCEL,
    }).ok
  )
    return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json(await drainNotifications());
}
