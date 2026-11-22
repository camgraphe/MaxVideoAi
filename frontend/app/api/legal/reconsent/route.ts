import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getLegalDocumentUncached, type LegalDocumentKey } from '@/lib/legal';
import { AGE_ATTESTATION_VERSION, LEGAL_MIN_AGE } from '@/lib/legal-policy';
import { recordUserConsents, type ConsentSource, type ConsentEntry } from '@/server/legal-consents';
import { computeReconsentStatus, type ReconsentStatus } from '@/server/legal-reconsent-status';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

function serializeStatus(status: ReconsentStatus) {
  return {
    ok: true,
    needsReconsent: status.needsReconsent,
    ageConfirmationRequired: status.ageConfirmationRequired,
    minimumAge: LEGAL_MIN_AGE,
    shouldBlock: status.shouldBlock,
    mode: status.mode,
    graceEndsAt: status.graceEndsAt ? status.graceEndsAt.toISOString() : null,
    documents: status.documents,
  };
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const status = await computeReconsentStatus(userId);
    return NextResponse.json(serializeStatus(status));
  } catch (error) {
    console.error('[legal-reconsent] status check failed', error);
    return NextResponse.json({ ok: false, error: 'Unable to resolve legal status' }, { status: 500 });
  }
}

type PostBody = {
  ageConfirmed?: boolean;
  marketingOptIn?: boolean;
  documents?: LegalDocumentKey[];
  locale?: string | null;
  source?: ConsentSource;
};

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: PostBody = {};
  try {
    body = await req.json();
  } catch {
    // ignore: optional body
  }

  try {
    const status = await computeReconsentStatus(userId);
    if (!status.needsReconsent) {
      return NextResponse.json(serializeStatus(status));
    }

    if (status.ageConfirmationRequired && body.ageConfirmed !== true) {
      return NextResponse.json({ ok: false, error: 'Please confirm that you are at least 18 and have reached legal majority in your country.' }, { status: 422 });
    }

    const requested = new Set<LegalDocumentKey>((body.documents ?? status.documents.map((doc) => doc.key)));
    const entries: ConsentEntry[] = status.documents
      .filter((doc) => requested.has(doc.key))
      .map((doc) => ({
        docKey: doc.key,
        docVersion: doc.currentVersion,
        accepted: true,
        source: body.source ?? 'reconsent',
      }));

    if (status.ageConfirmationRequired) {
      entries.push({ docKey: 'age_attestation', docVersion: AGE_ATTESTATION_VERSION, accepted: true, source: body.source ?? 'reconsent' });
    }

    if (typeof body.marketingOptIn === 'boolean') {
      const privacy = await getLegalDocumentUncached('privacy');
      if (!privacy?.version) throw new Error('Privacy document is not configured');
      entries.push({ docKey: 'marketing', docVersion: privacy.version, accepted: body.marketingOptIn, source: body.source ?? 'reconsent' });
    }

    if (entries.length === 0) {
      return NextResponse.json({ ok: false, error: 'No documents provided for acceptance' }, { status: 400 });
    }

    await recordUserConsents({
      userId,
      entries,
      locale: body.locale ?? null,
      defaultSource: body.source ?? 'reconsent',
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    const refreshed = await computeReconsentStatus(userId);
    return NextResponse.json(serializeStatus(refreshed));
  } catch (error) {
    console.error('[legal-reconsent] acceptance failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to record consent' },
      { status: 500 }
    );
  }
}
