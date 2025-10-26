import { isDatabaseConfigured, query } from '@/lib/db';

export type ProfileSnapshot = {
  id: string;
  tosVersion: string | null;
  privacyVersion: string | null;
  cookiesVersion: string | null;
  marketingOptIn: boolean | null;
  marketingOptInAt: Date | null;
  ageVerified: boolean | null;
  markedForDeletionAt: Date | null;
};

export async function getProfileSnapshot(userId: string): Promise<ProfileSnapshot | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const rows = await query<{
      id: string;
      tos_version: string | null;
      privacy_version: string | null;
      cookies_version: string | null;
      marketing_opt_in: boolean | null;
      marketing_opt_in_at: Date | null;
      age_verified: boolean | null;
      marked_for_deletion_at: Date | null;
    }>(
      `select id, tos_version, privacy_version, cookies_version, marketing_opt_in, marketing_opt_in_at, age_verified, marked_for_deletion_at
       from profiles
       where id = $1
       limit 1`,
      [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      tosVersion: row.tos_version ?? null,
      privacyVersion: row.privacy_version ?? null,
      cookiesVersion: row.cookies_version ?? null,
      marketingOptIn: row.marketing_opt_in ?? null,
      marketingOptInAt: row.marketing_opt_in_at ?? null,
      ageVerified: row.age_verified ?? null,
      markedForDeletionAt: row.marked_for_deletion_at ?? null,
    };
  } catch (error) {
    console.warn('[profile] failed to load snapshot', error instanceof Error ? error.message : error);
    return null;
  }
}
