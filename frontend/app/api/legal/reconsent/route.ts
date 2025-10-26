import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/user';
import { getLegalDocumentUncached, type LegalDocumentKey } from '@/lib/legal';
import { recordUserConsents, type ConsentSource } from '@/server/legal-consents';
import { getProfileSnapshot } from '@/server/profile';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

type ReconsentMode = 'soft' | 'hard';

type DocumentStatus = {
  key: LegalDocumentKey;
  currentVersion: string;
  publishedAt: string | null;
  acceptedVersion: string | null;
};

function resolveMode(): ReconsentMode {
  const mode = (process.env.LEGAL_RECONSENT_MODE ?? 'soft').toLowerCase();
  return mode === 'hard' ? 'hard' : 'soft';
}

function resolveGraceDays(): number {
  const value = Number.parseInt(process.env.LEGAL_RECONSENT_GRACE_DAYS ?? '14', 10);
  return Number.isNaN(value) || value < 0 ? 0 : value;
}

function addDays(base: Date, days: number): Date {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function fetchDocuments(keys: LegalDocumentKey[]): Promise<Array<{ key: LegalDocumentKey; version: string | null; publishedAt: Date | null }>> {
  const docs = await Promise.all(
    keys.map(async (key) => {
      const doc = await getLegalDocumentUncached(key);
      return {
        key,
        version: doc?.version ?? null,
        publishedAt: doc?.publishedAt ?? null,
      };
    })
  );
  return docs;
}

async function fetchLatestConsents(userId: string): Promise<Record<LegalDocumentKey, string | null>> {
  const latest: Record<LegalDocumentKey, string | null> = {
    terms: null,
    privacy: null,
    cookies: null,
  };
  try {
    const rows = await query<{ doc_key: string; doc_version: string }>(
      `select doc_key, doc_version
       from user_consents
       where user_id = $1
       order by accepted_at desc`,
      [userId]
    );
    for (const row of rows) {
      if ((row.doc_key === 'terms' || row.doc_key === 'privacy' || row.doc_key === 'cookies') && !latest[row.doc_key]) {
        latest[row.doc_key] = row.doc_version;
      }
    }
  } catch (error) {
    console.warn('[legal-reconsent] failed to load consent history', error);
  }
  return latest;
}

type RawStatus = {
  needsReconsent: boolean;
  shouldBlock: boolean;
  mode: ReconsentMode;
  graceEndsAt: Date | null;
  documents: DocumentStatus[];
};

async function computeReconsentStatus(userId: string): Promise<RawStatus> {
  const mode = resolveMode();
  const graceDays = resolveGraceDays();
  const [profile, documents, latestConsents] = await Promise.all([
    getProfileSnapshot(userId),
    fetchDocuments(['terms', 'privacy', 'cookies']),
    fetchLatestConsents(userId),
  ]);

  const mismatches: DocumentStatus[] = [];
  for (const doc of documents) {
    if (!doc.version) continue;
    let acceptedVersion: string | null = null;
    if (doc.key === 'terms') {
      acceptedVersion = profile?.tosVersion ?? latestConsents.terms;
    } else if (doc.key === 'privacy') {
      acceptedVersion = profile?.privacyVersion ?? latestConsents.privacy;
    } else if (doc.key === 'cookies') {
      acceptedVersion = profile?.cookiesVersion ?? latestConsents.cookies;
    }
    if (acceptedVersion !== doc.version) {
      mismatches.push({
        key: doc.key,
        currentVersion: doc.version,
        publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
        acceptedVersion,
      });
    }
  }

  if (mismatches.length === 0) {
    return {
      needsReconsent: false,
      shouldBlock: false,
      mode,
      graceEndsAt: null,
      documents: [],
    };
  }

  const now = new Date();
  const deadlines = mismatches
    .map((doc) => {
      if (!doc.publishedAt) return null;
      const published = new Date(doc.publishedAt);
      if (Number.isNaN(published.getTime())) return null;
      return addDays(published, graceDays);
    })
    .filter((value): value is Date => value instanceof Date);

  const graceEndsAt =
    mode === 'soft' && deadlines.length > 0
      ? deadlines.reduce<Date | null>((earliest, date) => {
          if (!earliest) return date;
          return date < earliest ? date : earliest;
        }, null)
      : null;

  const shouldBlock =
    mode === 'hard' ||
    (mode === 'soft' && graceEndsAt !== null && now.getTime() >= graceEndsAt.getTime());

  return {
    needsReconsent: true,
    shouldBlock,
    mode,
    graceEndsAt,
    documents: mismatches,
  };
}

function serializeStatus(status: RawStatus) {
  return {
    ok: true,
    needsReconsent: status.needsReconsent,
    shouldBlock: status.shouldBlock,
    mode: status.mode,
    graceEndsAt: status.graceEndsAt ? status.graceEndsAt.toISOString() : null,
    documents: status.documents,
  };
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
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
  documents?: LegalDocumentKey[];
  locale?: string | null;
  source?: ConsentSource;
};

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
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

    const requested = new Set<LegalDocumentKey>((body.documents ?? status.documents.map((doc) => doc.key)));
    const entries = status.documents
      .filter((doc) => requested.has(doc.key))
      .map((doc) => ({
        docKey: doc.key,
        docVersion: doc.currentVersion,
        accepted: true,
        source: body.source ?? 'reconsent',
      }));

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
