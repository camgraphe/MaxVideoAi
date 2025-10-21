import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getUserIdFromRequest } from '@/lib/user';
import { countUserExports, ensureUserPreferences } from '@/server/preferences';

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureBillingSchema();
    const [count, prefs] = await Promise.all([
      countUserExports(userId),
      ensureUserPreferences(userId),
    ]);

    return NextResponse.json({
      ok: true,
      total: count,
      onboardingDone: prefs.onboardingDone,
    });
  } catch (error) {
    console.error('[api/user/exports/summary] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
