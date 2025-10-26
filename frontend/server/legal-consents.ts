import { isDatabaseConfigured, query } from '@/lib/db';
import { getLegalDocumentUncached, type LegalDocumentKey } from '@/lib/legal';

export type ConsentSource = 'signup' | 'settings' | 'cookie_banner' | 'reconsent';

export type ConsentEntry = {
  docKey: LegalDocumentKey | 'marketing' | 'age_attestation' | 'cookies.analytics' | 'cookies.ads';
  docVersion: string;
  accepted: boolean;
  source?: ConsentSource | string;
};

export type RecordConsentsInput = {
  userId: string;
  entries: ConsentEntry[];
  ip?: string | null;
  userAgent?: string | null;
  locale?: string | null;
  defaultSource?: ConsentSource;
};

type ProfileUpdates = {
  tosVersion?: string;
  privacyVersion?: string;
  cookiesVersion?: string;
  marketingOptIn?: boolean;
  marketingOptInAt?: Date | null;
  ageVerified?: boolean;
};

export async function resolveCurrentLegalVersions(keys: LegalDocumentKey[]): Promise<Record<LegalDocumentKey, string | null>> {
  const versions: Record<LegalDocumentKey, string | null> = {
    terms: null,
    privacy: null,
    cookies: null,
  };
  await Promise.all(
    keys.map(async (key) => {
      const doc = await getLegalDocumentUncached(key);
      versions[key] = doc?.version ?? null;
    })
  );
  return versions;
}

export async function recordUserConsents(input: RecordConsentsInput): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!input.userId || !input.entries.length) return;

  const acceptedAt = new Date();
  const values: string[] = [];
  const params: unknown[] = [];

  const ipValue = input.ip?.trim() ?? null;
  const uaValue = input.userAgent?.trim() ?? null;
  const localeValue = input.locale?.trim() ?? null;
  const defaultSource = input.defaultSource ?? 'signup';

  for (let index = 0; index < input.entries.length; index += 1) {
    const entry = input.entries[index];
    const offset = index * 9;
    values.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`
    );
    params.push(
      input.userId,
      entry.docKey,
      entry.docVersion,
      entry.accepted,
      acceptedAt,
      ipValue,
      uaValue,
      localeValue,
      entry.source ?? defaultSource
    );
  }

  const consentSql = `
    INSERT INTO user_consents (user_id, doc_key, doc_version, accepted, accepted_at, ip, user_agent, locale, source)
    VALUES ${values.join(', ')}
    ON CONFLICT (user_id, doc_key, doc_version)
    DO UPDATE SET
      accepted = EXCLUDED.accepted,
      accepted_at = EXCLUDED.accepted_at,
      ip = COALESCE(EXCLUDED.ip, user_consents.ip),
      user_agent = COALESCE(EXCLUDED.user_agent, user_consents.user_agent),
      locale = COALESCE(EXCLUDED.locale, user_consents.locale),
      source = EXCLUDED.source;
  `;

  await query(consentSql, params);

  const profile: ProfileUpdates = {};
  for (const entry of input.entries) {
    if (entry.docKey === 'terms' && entry.accepted) {
      profile.tosVersion = entry.docVersion;
    }
    if (entry.docKey === 'privacy' && entry.accepted) {
      profile.privacyVersion = entry.docVersion;
    }
    if (entry.docKey === 'cookies' && entry.accepted) {
      profile.cookiesVersion = entry.docVersion;
    }
    if (entry.docKey === 'marketing') {
      profile.marketingOptIn = entry.accepted;
      profile.marketingOptInAt = entry.accepted ? acceptedAt : null;
    }
    if (entry.docKey === 'age_attestation' && entry.accepted) {
      profile.ageVerified = true;
    }
  }

  const hasProfileUpdates = Object.keys(profile).length > 0;
  if (!hasProfileUpdates) {
    return;
  }

  const updateColumns: string[] = ['id'];
  const insertPlaceholders: string[] = ['$1'];
  const updateAssignments: string[] = [];
  const updateParams: unknown[] = [input.userId];
  let paramIndex = 2;

  if (profile.tosVersion) {
    updateColumns.push('tos_version');
    insertPlaceholders.push(`$${paramIndex}`);
    updateAssignments.push(`tos_version = EXCLUDED.tos_version`);
    updateParams.push(profile.tosVersion);
    paramIndex += 1;
  }

  if (profile.privacyVersion) {
    updateColumns.push('privacy_version');
    insertPlaceholders.push(`$${paramIndex}`);
    updateAssignments.push(`privacy_version = EXCLUDED.privacy_version`);
    updateParams.push(profile.privacyVersion);
    paramIndex += 1;
  }

  if (profile.cookiesVersion) {
    updateColumns.push('cookies_version');
    insertPlaceholders.push(`$${paramIndex}`);
    updateAssignments.push(`cookies_version = EXCLUDED.cookies_version`);
    updateParams.push(profile.cookiesVersion);
    paramIndex += 1;
  }

  if (profile.marketingOptIn !== undefined) {
    updateColumns.push('marketing_opt_in');
    insertPlaceholders.push(`$${paramIndex}`);
    updateAssignments.push(`marketing_opt_in = EXCLUDED.marketing_opt_in`);
    updateParams.push(profile.marketingOptIn);
    paramIndex += 1;

    updateColumns.push('marketing_opt_in_at');
    insertPlaceholders.push(`$${paramIndex}`);
    updateAssignments.push(`marketing_opt_in_at = EXCLUDED.marketing_opt_in_at`);
    updateParams.push(profile.marketingOptInAt ?? null);
    paramIndex += 1;
  }

  if (profile.ageVerified !== undefined) {
    updateColumns.push('age_verified');
    insertPlaceholders.push(`$${paramIndex}`);
    updateAssignments.push(`age_verified = EXCLUDED.age_verified`);
    updateParams.push(profile.ageVerified);
    paramIndex += 1;
  }

  const insertSql = `
    INSERT INTO profiles (${updateColumns.join(', ')})
    VALUES (${insertPlaceholders.join(', ')})
    ON CONFLICT (id)
    DO UPDATE SET ${updateAssignments.join(', ')};
  `;

  await query(insertSql, updateParams);
}
