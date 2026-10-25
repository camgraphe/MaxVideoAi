import { query, type QueryExecutor } from '@/lib/db';
import { isUserAdmin } from '@/server/admin';

/** The storage namespace alone is never an access grant. Match a ready manifest exactly. */
export async function canReadMarketingFile(
  url: string,
  userId?: string | null,
  dependencies: { db?: QueryExecutor; enabled?: boolean; isAdmin?: typeof isUserAdmin } = {},
): Promise<boolean> {
  if (!(dependencies.enabled ?? process.env.MARKETING_MEDIA_ENABLED === '1')) return false;
  const rows = await (dependencies.db ?? { query }).query<{ visibility: string }>(
    `SELECT publication->>'visibility' AS visibility FROM marketing_media
     WHERE state='ready' AND files @> $1::jsonb LIMIT 1`,
    [JSON.stringify([{ url }])],
  );
  return Boolean(
    rows.length &&
      (rows[0].visibility === 'public' || (userId && (await (dependencies.isAdmin ?? isUserAdmin)(userId)))),
  );
}
