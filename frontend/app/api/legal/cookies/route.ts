import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/user';
import { getLegalDocumentUncached } from '@/lib/legal';
import { recordUserConsents } from '@/server/legal-consents';

export const runtime = 'nodejs';

type ConsentBody = {
  version?: string;
  categories?: Record<string, boolean>;
};

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export async function POST(req: NextRequest) {
  let body: ConsentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const doc = await getLegalDocumentUncached('cookies');
  if (!doc) {
    return NextResponse.json({ ok: false, error: 'Cookie policy not configured' }, { status: 500 });
  }

  const categories = {
    analytics: normalizeBoolean(body.categories?.analytics),
    ads: normalizeBoolean(body.categories?.ads),
  };

  try {
    const userId = await getUserIdFromRequest(req);
    if (userId) {
      await recordUserConsents({
        userId,
        entries: [
          { docKey: 'cookies', docVersion: doc.version, accepted: true, source: 'cookie_banner' },
          { docKey: 'cookies.analytics', docVersion: doc.version, accepted: categories.analytics, source: 'cookie_banner' },
          { docKey: 'cookies.ads', docVersion: doc.version, accepted: categories.ads, source: 'cookie_banner' },
        ],
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: req.headers.get('user-agent'),
        defaultSource: 'cookie_banner',
      });
    }

    return NextResponse.json({ ok: true, version: doc.version });
  } catch (error) {
    console.error('[legal-cookies] failed to record consent', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to record consent' },
      { status: 500 }
    );
  }
}
