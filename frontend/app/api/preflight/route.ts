import { NextRequest, NextResponse } from 'next/server';
import { computeConfiguredPreflight } from '@/server/engines';

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  const res = await computeConfiguredPreflight(payload);
  const status = res.ok ? 200 : 400;
  return NextResponse.json(res, { status });
}
