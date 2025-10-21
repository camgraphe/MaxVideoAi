import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { reorderHomepageSections } from '@/server/homepage';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminId: string;
  try {
    adminId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const { order } = body as { order?: string[] };

  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string' || !id)) {
    return NextResponse.json({ ok: false, error: 'Invalid order payload' }, { status: 400 });
  }

  try {
    await reorderHomepageSections(order, adminId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/homepage/reorder] failed to update order', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
