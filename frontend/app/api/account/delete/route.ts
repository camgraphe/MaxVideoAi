import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await query<{ marked_for_deletion_at: Date | string }>(
      `UPDATE profiles
       SET marked_for_deletion_at = COALESCE(marked_for_deletion_at, NOW()),
           marketing_opt_in = FALSE,
           marketing_opt_in_at = NULL
       WHERE id = $1
       RETURNING marked_for_deletion_at`,
      [userId]
    );

    if (!rows[0]) {
      return NextResponse.json({ ok: false, error: 'Account profile not found' }, { status: 404 });
    }

    console.info('[dsar] account marked for deletion', { userId });

    return NextResponse.json({
      ok: true,
      status: 'requested',
      markedAt: new Date(rows[0].marked_for_deletion_at).toISOString(),
      // This route records the request; it does not schedule or execute erasure.
      deletionCompleted: false,
    });
  } catch (error) {
    console.error('[dsar] account delete failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to record deletion request' },
      { status: 500 }
    );
  }
}
