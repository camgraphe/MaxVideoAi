import type { QueryExecutor } from '@/lib/db';
import { ownedMediaStorageKeyForUrl } from '@/server/storage';
import type { BytePlusMarketingInput } from './contract';

export type BytePlusImportAsset = { public_id: string; user_id: string; kind: string; url: string; thumb_url: string | null;
  mime_type: string; size_bytes: number | string; status: string; deleted_at: string | null };

export async function assertBytePlusImportAdmin(db: QueryExecutor, actorId: string, lock = false) {
  if (lock) await db.query('LOCK TABLE user_roles IN SHARE MODE');
  const admins = await db.query<{ user_id: string }>("SELECT user_id FROM user_roles WHERE role='admin'");
  if (admins.length) {
    if (!admins.some(admin => admin.user_id === actorId)) throw new Error('BYTEPLUS_IMPORT_ADMIN_REQUIRED');
  } else {
    if (lock) await db.query('LOCK TABLE app_admins IN SHARE MODE');
    if ((await db.query('SELECT user_id FROM app_admins WHERE user_id=$1', [actorId])).length !== 1)
      throw new Error('BYTEPLUS_IMPORT_ADMIN_REQUIRED');
  }
}

export async function loadBytePlusImportAssets(input: BytePlusMarketingInput, db: QueryExecutor, lock = false) {
  const selections = [ { assetId: input.videoAssetId, kind: 'video' },
    ...(input.poster.assetId ? [{ assetId: input.poster.assetId, kind: 'image' }] : []),
    ...(input.preview ? [{ assetId: input.preview.assetId, kind: 'video' }] : []),
    ...input.references.map(ref => ({ assetId: ref.assetId, kind: ref.mime.split('/')[0] })),
  ];
  const ids = [...new Set(selections.map(item => item.assetId))].sort();
  const rows = await db.query<BytePlusImportAsset>(`SELECT public_id,user_id,kind,url,thumb_url,mime_type,size_bytes,status,deleted_at
    FROM media_assets WHERE public_id=ANY($1::text[]) ORDER BY public_id ${lock ? 'FOR SHARE' : ''}`, [ids]);
  if (ids.length !== rows.length || selections.some(item => {
    const asset = rows.find(row => row.public_id === item.assetId);
    return !asset || asset.user_id !== input.ownerUserId || asset.status !== 'ready' || asset.deleted_at || asset.kind !== item.kind;
  })) throw new Error('BYTEPLUS_IMPORT_ASSET_OWNER_OR_READINESS');
  for (const row of rows) {
    const url = new URL(row.url);
    if (url.protocol !== 'https:' || url.port || url.search || url.hash || url.username || url.password
      || !ownedMediaStorageKeyForUrl({ url: row.url, userId: input.ownerUserId })) throw new Error('BYTEPLUS_IMPORT_ASSET_URL');
  }
  const posterUrl = input.poster.assetId ? rows.find(row => row.public_id === input.poster.assetId)!.url
    : rows.find(row => row.public_id === input.videoAssetId)!.thumb_url;
  if (!posterUrl || new URL(posterUrl).protocol !== 'https:' || new URL(posterUrl).search || new URL(posterUrl).hash
    || !ownedMediaStorageKeyForUrl({ url: posterUrl, userId: input.ownerUserId })) throw new Error('BYTEPLUS_IMPORT_ASSET_POSTER');
  return rows;
}
