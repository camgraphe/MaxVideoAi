import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });
  // For now, no change to video; mark can_upscale true (already) and just ack
  await ensureBillingSchema();
  await query(`UPDATE app_jobs SET can_upscale = TRUE WHERE job_id = $1`, [body.jobId]);
  return NextResponse.json({ ok: true });
}
