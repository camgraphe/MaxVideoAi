import { getLegalDocumentUncached, type LegalDocumentKey } from '@/lib/legal';
import { AGE_ATTESTATION_VERSION } from '@/lib/legal-policy';
import { getProfileSnapshot } from '@/server/profile';
import { query } from '@/lib/db';

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

async function fetchLatestConsents(userId: string): Promise<Record<LegalDocumentKey | 'age_attestation', string | null>> {
  const latest: Record<LegalDocumentKey | 'age_attestation', string | null> = {
    terms: null,
    privacy: null,
    cookies: null,
    age_attestation: null,
  };
  try {
    const rows = await query<{ doc_key: string; doc_version: string }>(
      `select doc_key, doc_version
       from user_consents
       where user_id = $1 and accepted = true
       order by accepted_at desc`,
      [userId]
    );
    for (const row of rows) {
      if ((row.doc_key === 'terms' || row.doc_key === 'privacy' || row.doc_key === 'cookies' || row.doc_key === 'age_attestation') && !latest[row.doc_key]) {
        latest[row.doc_key] = row.doc_version;
      }
    }
  } catch (error) {
    console.warn('[legal-reconsent] failed to load consent history', error);
  }
  return latest;
}

export type ReconsentStatus = {
  needsReconsent: boolean;
  ageConfirmationRequired: boolean;
  shouldBlock: boolean;
  mode: ReconsentMode;
  graceEndsAt: Date | null;
  documents: DocumentStatus[];
};

export async function computeReconsentStatus(userId: string): Promise<ReconsentStatus> {
  const mode = resolveMode();
  const graceDays = resolveGraceDays();
  const [profile, documents, latestConsents] = await Promise.all([
    getProfileSnapshot(userId),
    fetchDocuments(['terms', 'privacy', 'cookies']),
    fetchLatestConsents(userId),
  ]);

  const ageConfirmationRequired = latestConsents.age_attestation !== AGE_ATTESTATION_VERSION;
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

  if (mismatches.length === 0 && !ageConfirmationRequired) {
    return {
      needsReconsent: false,
      ageConfirmationRequired: false,
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
    ageConfirmationRequired || mode === 'hard' ||
    (mode === 'soft' && graceEndsAt !== null && now.getTime() >= graceEndsAt.getTime());

  return {
    needsReconsent: true,
    ageConfirmationRequired,
    shouldBlock,
    mode,
    graceEndsAt,
    documents: mismatches,
  };
}
