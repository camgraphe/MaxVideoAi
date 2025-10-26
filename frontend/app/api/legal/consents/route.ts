import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { recordUserConsents, resolveCurrentLegalVersions, type ConsentSource } from '@/server/legal-consents';
import { getSupabaseAdmin } from '@/server/supabase-admin';

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
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 });
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

    const marketingVersion = versions.privacy ?? versions.terms ?? versions.cookies ?? '2025-10-26';
    const minAge = Number.parseInt(process.env.LEGAL_MIN_AGE ?? '15', 10);
    const ageVersion = Number.isNaN(minAge) ? 'age_gate' : `min_age:${minAge}`;

    const entries = [
      { docKey: 'terms' as const, docVersion: versions.terms ?? '2025-10-26', accepted: true, source: body.source ?? 'signup' },
      { docKey: 'privacy' as const, docVersion: versions.privacy ?? '2025-10-26', accepted: true, source: body.source ?? 'signup' },
      {
        docKey: 'age_attestation' as const,
        docVersion: ageVersion,
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

    const supabaseConfigured =
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (supabaseConfigured) {
      try {
        const admin = getSupabaseAdmin();
        const { data, error } = await admin.auth.admin.getUserById(body.userId);
        if (error || !data?.user) {
          return NextResponse.json({ ok: false, error: 'Supabase user not found' }, { status: 404 });
        }
      } catch (error) {
        console.warn('[legal-consent] Supabase verification failed', error);
        return NextResponse.json({ ok: false, error: 'Unable to verify user identity' }, { status: 500 });
      }
    }

    await recordUserConsents({
      userId: body.userId,
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
