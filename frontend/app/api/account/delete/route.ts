import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await query(
      `UPDATE profiles
       SET marked_for_deletion_at = NOW(),
           marketing_opt_in = FALSE,
           marketing_opt_in_at = NULL
       WHERE id = $1`,
      [userId]
    );

    console.info('[dsar] account marked for deletion', { userId });

    return NextResponse.json({
      ok: true,
      markedAt: new Date().toISOString(),
      hardDeleteScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[dsar] account delete failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to flag account for deletion' },
      { status: 500 }
    );
  }
}
