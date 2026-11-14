import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { recordUserConsents, resolveCurrentLegalVersions, type ConsentSource, type ConsentEntry } from '@/server/legal-consents';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { AGE_ATTESTATION_VERSION } from '@/lib/legal-policy';
import { LEGAL_FALLBACK_VERSIONS } from '@/lib/legal';

export const runtime = 'nodejs';

type RequestBody = {
  userId?: string;
  marketingOptIn?: boolean;
  ageConfirmed?: boolean;
  locale?: string | null;
  source?: ConsentSource;
};

const REQUIRED_DOCS = ['terms', 'privacy'] as const;

function parseClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded && forwarded.trim().length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.userId !== undefined && body.userId !== userId) {
    return NextResponse.json({ ok: false, error: 'Consent owner does not match the authenticated account' }, { status: 403 });
  }

  if (body.ageConfirmed !== true) {
    return NextResponse.json({ ok: false, error: 'Age attestation is required to create an account' }, { status: 422 });
  }

  try {
    const versions = await resolveCurrentLegalVersions(['terms', 'privacy', 'cookies']);
    for (const key of REQUIRED_DOCS) {
      if (!versions[key]) {
        return NextResponse.json(
          { ok: false, error: `Legal document "${key}" is not configured` },
          { status: 500 }
        );
      }
    }

    const marketingVersion = versions.privacy ?? versions.terms ?? versions.cookies ?? LEGAL_FALLBACK_VERSIONS.privacy;

    const entries: ConsentEntry[] = [
      { docKey: 'terms' as const, docVersion: versions.terms ?? LEGAL_FALLBACK_VERSIONS.terms, accepted: true, source: body.source ?? 'signup' },
      { docKey: 'privacy' as const, docVersion: versions.privacy ?? LEGAL_FALLBACK_VERSIONS.privacy, accepted: true, source: body.source ?? 'signup' },
      {
        docKey: 'age_attestation' as const,
        docVersion: AGE_ATTESTATION_VERSION,
        accepted: true,
        source: body.source ?? 'signup',
      },
    ];

    if (typeof body.marketingOptIn === 'boolean') {
      entries.push({
        docKey: 'marketing',
        docVersion: marketingVersion,
        accepted: body.marketingOptIn,
        source: body.source ?? 'signup',
      });
    }

    await recordUserConsents({
      userId,
      entries,
      ip: parseClientIp(req),
      userAgent: req.headers.get('user-agent'),
      locale: body.locale ?? null,
      defaultSource: body.source ?? 'signup',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[legal-consent] failed to record consent', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to record consent' },
      { status: 500 }
    );
  }
}
