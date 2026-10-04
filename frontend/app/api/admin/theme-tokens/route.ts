import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';

export const runtime = 'nodejs';

async function retiredThemeResponse(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  return NextResponse.json(
    { ok: false, error: 'The theme editor has been retired. Existing theme settings remain active.' },
    { status: 410 }
  );
}

export const GET = retiredThemeResponse;
export const PUT = retiredThemeResponse;
export const DELETE = retiredThemeResponse;
