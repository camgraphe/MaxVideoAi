import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ ok: false });
    }
    console.error('[admin/access] failed to check admin access', error);
    return NextResponse.json({ ok: false, error: 'Failed to check access' }, { status: 500 });
  }
}
