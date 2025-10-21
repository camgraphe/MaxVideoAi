import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getUserIdFromRequest } from '@/lib/user';
import {
  ensureUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from '@/server/preferences';

function serializePreferences(prefs: UserPreferences) {
  return {
    defaultSharePublic: prefs.defaultSharePublic,
    defaultAllowIndex: prefs.defaultAllowIndex,
    onboardingDone: prefs.onboardingDone,
  };
}

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
    const prefs = await ensureUserPreferences(userId);
    return NextResponse.json({ ok: true, preferences: serializePreferences(prefs) });
  } catch (error) {
    console.error('[api/user/preferences] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureBillingSchema();
    const body = await req.json().catch(() => ({}));
    const updates: Partial<UserPreferences> = {};
    if (typeof body?.defaultSharePublic === 'boolean') {
      updates.defaultSharePublic = body.defaultSharePublic;
    }
    if (typeof body?.defaultAllowIndex === 'boolean') {
      updates.defaultAllowIndex = body.defaultAllowIndex;
    }
    if (typeof body?.onboardingDone === 'boolean') {
      updates.onboardingDone = body.onboardingDone;
    }
    const prefs = await updateUserPreferences(userId, updates);
    return NextResponse.json({ ok: true, preferences: serializePreferences(prefs) });
  } catch (error) {
    console.error('[api/user/preferences] update failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
