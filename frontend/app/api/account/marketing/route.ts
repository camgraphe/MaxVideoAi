import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getLegalDocumentUncached } from '@/lib/legal';
import { getProfileSnapshot } from '@/server/profile';
import { recordUserConsents } from '@/server/legal-consents';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

type MarketingResponse = {
  ok: boolean;
  optIn: boolean;
  updatedAt: string | null;
  requiresDoubleOptIn?: boolean;
};

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const profile = await getProfileSnapshot(userId);
    return NextResponse.json<MarketingResponse>({
      ok: true,
      optIn: Boolean(profile?.marketingOptIn),
      updatedAt: profile?.marketingOptInAt ? profile.marketingOptInAt.toISOString() : null,
    });
  } catch (error) {
    console.error('[marketing-pref] fetch failed', error);
    return NextResponse.json({ ok: false, error: 'Unable to load marketing preference' }, { status: 500 });
  }
}

type PostBody = {
  optIn?: boolean;
};

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const optIn = body.optIn === true;
  const doubleOptIn = (process.env.MARKETING_DOUBLE_OPT_IN ?? 'false').toLowerCase() === 'true';

  try {
    const privacyDoc = await getLegalDocumentUncached('privacy');
    const marketingVersion = privacyDoc?.version ?? '2025-10-26';

    if (doubleOptIn && optIn) {
      console.warn('[marketing-pref] double opt-in requested but email workflow is not yet implemented.');
      // Future: send confirmation email, mark pending.
      return NextResponse.json<MarketingResponse>({
        ok: true,
        optIn: false,
        updatedAt: null,
        requiresDoubleOptIn: true,
      });
    }

    await recordUserConsents({
      userId,
      entries: [
        {
          docKey: 'marketing',
          docVersion: marketingVersion,
          accepted: optIn,
          source: 'settings',
        },
      ],
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent'),
      defaultSource: 'settings',
    });

    const profile = await getProfileSnapshot(userId);

    return NextResponse.json<MarketingResponse>({
      ok: true,
      optIn: Boolean(profile?.marketingOptIn),
      updatedAt: profile?.marketingOptInAt ? profile.marketingOptInAt.toISOString() : null,
    });
  } catch (error) {
    console.error('[marketing-pref] update failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update marketing preference' },
      { status: 500 }
    );
  }
}
