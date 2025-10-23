import { query } from '@/lib/db';
import { removeUserVideosFromIndexablePlaylists } from '@/server/indexing';

type PreferencesRow = {
  user_id: string;
  default_share_public: boolean;
  default_allow_index: boolean;
  onboarding_done: boolean;
};

export type UserPreferences = {
  defaultSharePublic: boolean;
  defaultAllowIndex: boolean;
  onboardingDone: boolean;
};

function mapPreferences(row: PreferencesRow): UserPreferences {
  return {
    defaultSharePublic: row.default_share_public,
    defaultAllowIndex: row.default_allow_index,
    onboardingDone: row.onboarding_done,
  };
}

export async function ensureUserPreferences(userId: string): Promise<UserPreferences> {
  await query(
    `
      INSERT INTO user_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
  const rows = await query<PreferencesRow>(
    `SELECT user_id, default_share_public, default_allow_index, onboarding_done FROM user_preferences WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (!rows[0]) {
    return { defaultSharePublic: true, defaultAllowIndex: true, onboardingDone: false };
  }
  return mapPreferences(rows[0]);
}

export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await ensureUserPreferences(userId);
  const next: UserPreferences = {
    defaultSharePublic:
      updates.defaultSharePublic ?? current.defaultSharePublic,
    defaultAllowIndex:
      updates.defaultAllowIndex ?? current.defaultAllowIndex,
    onboardingDone: updates.onboardingDone ?? current.onboardingDone,
  };

  await query(
    `
      INSERT INTO user_preferences (user_id, default_share_public, default_allow_index, onboarding_done, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        default_share_public = EXCLUDED.default_share_public,
        default_allow_index = EXCLUDED.default_allow_index,
        onboarding_done = EXCLUDED.onboarding_done,
        updated_at = NOW()
    `,
    [userId, next.defaultSharePublic, next.defaultAllowIndex, next.onboardingDone]
  );

  return next;
}

export async function markOnboardingDone(userId: string): Promise<void> {
  await updateUserPreferences(userId, { onboardingDone: true });
}

export async function applyIndexOptOut(userId: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `
      WITH updated AS (
        UPDATE app_jobs
        SET indexable = FALSE
        WHERE user_id = $1
        RETURNING 1
      )
      SELECT COUNT(*)::text AS count FROM updated
    `,
    [userId]
  );
  await removeUserVideosFromIndexablePlaylists(userId);
  return Number(rows[0]?.count ?? '0');
}

export async function countUserExports(userId: string): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM app_jobs WHERE user_id = $1 AND hidden IS NOT TRUE`,
    [userId]
  );
  return Number(rows[0]?.count ?? '0');
}
