import type { GeneratePayload } from '@/lib/fal-types';

type Query = <T>(sql: string, values?: unknown[]) => Promise<T[]>;
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

export async function minimaxH3OwnedReferences(userId: string, inputs: NonNullable<GeneratePayload['inputs']>, queryFn: Query): Promise<boolean> {
  if (inputs.length !== 2) return false;
  try {
    const ids: string[] = [];
    const urls: string[] = [];
    for (const input of inputs) {
      const id = input.assetId?.trim();
      const url = input.url?.trim();
      if (!id || !url) return false;
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return false;
      ids.push(id);
      urls.push(url);
    }
    const [row] = await queryFn<{ verified: boolean }>(`
      SELECT NOT EXISTS (
        SELECT 1 FROM unnest($2::text[], $3::text[]) AS wanted(asset_id, url)
        WHERE NOT EXISTS (
          SELECT 1 FROM user_assets a
          WHERE a.user_id = $1 AND a.asset_id = wanted.asset_id AND a.url = wanted.url
            AND lower(split_part(a.mime_type, ';', 1)) = ANY($4::text[])
        ) AND NOT EXISTS (
          SELECT 1 FROM media_assets a
          WHERE a.user_id = $1 AND a.kind = 'image' AND a.deleted_at IS NULL AND a.status = 'ready'
            AND md5(a.url) = md5(wanted.url) AND a.url = wanted.url
            AND (a.public_id = wanted.asset_id OR a.id::text = wanted.asset_id)
            AND lower(split_part(a.mime_type, ';', 1)) = ANY($4::text[])
        )
      ) AS verified`, [userId, ids, urls, imageMimeTypes]);
    return row?.verified === true;
  } catch {
    // An unverifiable reference continues through the existing Fal path.
    return false;
  }
}
