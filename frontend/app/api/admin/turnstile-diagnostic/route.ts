import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { handleTurnstileDiagnostic } from '@/server/turnstile-diagnostic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let actorId: string;
  try {
    actorId = await requireAdmin(request);
  } catch (error) {
    return NextResponse.json({ error: 'admin_access_required' }, {
      status: error instanceof AdminAuthError ? error.status : 403,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  return handleTurnstileDiagnostic(request, actorId);
}
