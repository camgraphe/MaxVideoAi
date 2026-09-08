import { query } from '@/lib/db';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';
import { readMediaFacts } from '@/lib/media-identity';
import { validReferenceMediaUrl } from '@/server/agent-api/reference-assets';
import { resolveSupportedReferenceMedia } from '@/server/agent-api/reference-media-policy';
import { extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl } from '@/server/storage';

type MediaRow = { id: string; public_id?: string; job_id?: string; user_id: string; kind: string; url: string; storage_url?: string | null; thumb_url?: string | null; preview_url?: string | null; mime_type?: string | null; original_name?: string | null; metadata?: Record<string, unknown>; status: string; deleted_at?: unknown; hidden?: boolean; job_user_id?: string };
export type StudioMediaExecutor = (sql: string, values: string[]) => Promise<MediaRow[]>;
export type StudioResolvedMedia = {
  id: string;
  ref: ToolAssetRef;
  kind: 'video' | 'image' | 'audio';
  url: string;
  thumbUrl: string | null;
  previewUrl: string | null;
  mime: string;
  mediaFacts: ReturnType<typeof readMediaFacts>;
  originalAccess: { type: 'owned-storage'; storageKey: string } | { type: 'external' };
  originalName?: string;
};

/** Read-only exact owner lookup. No schema creation, ensure, copy or caller-supplied URL. */
export async function resolveStudioMedia(
  userId: string,
  input: unknown,
  execute: StudioMediaExecutor = query,
  options: { lockAsset?: boolean } = {},
): Promise<StudioResolvedMedia> {
  if (!userId) throw new Error('UNAUTHORIZED');
  const ref = toolAssetRefSchema.parse(input);
  const rows = ref.type === 'asset'
    ? await execute(`SELECT a.*, j.hidden, j.user_id AS job_user_id FROM media_assets a
        LEFT JOIN job_outputs source_output ON source_output.id = a.source_output_id
        LEFT JOIN app_jobs j ON j.job_id = COALESCE(a.source_job_id, source_output.job_id)
        WHERE a.user_id = $1 AND a.public_id = $2 AND a.kind = $3
          AND a.status = 'ready' AND a.deleted_at IS NULL AND j.hidden IS NOT TRUE
          AND (a.source_job_id IS NULL OR j.user_id = $1)
          AND (a.source_output_id IS NULL OR (source_output.user_id = $1 AND source_output.status = 'ready' AND j.user_id = $1
            AND (a.source_job_id IS NULL OR a.source_job_id = source_output.job_id)))
        LIMIT 1${options.lockAsset ? ' FOR SHARE OF a' : ''}`, [userId, ref.assetId, ref.kind])
    : await execute(`SELECT o.*, j.hidden, j.user_id AS job_user_id FROM job_outputs o
        JOIN app_jobs j ON j.job_id = o.job_id
        WHERE o.user_id = $1 AND j.user_id = $1 AND o.job_id = $2 AND o.id = $3 AND o.kind = $4
          AND o.status = 'ready' AND j.hidden IS NOT TRUE LIMIT 1`, [userId, ref.jobId, ref.outputId, ref.kind]);
  const row = rows[0];
  if (!row || row.user_id !== userId || row.kind !== ref.kind || row.status !== 'ready' || row.deleted_at || row.hidden
    || (row.job_user_id && row.job_user_id !== userId)
    || (ref.type === 'asset' ? row.public_id !== ref.assetId : row.id !== ref.outputId || row.job_id !== ref.jobId)) {
    throw new Error('MEDIA_NOT_AVAILABLE');
  }
  const url = row.storage_url || row.url;
  const media = resolveSupportedReferenceMedia(row.kind, row.mime_type);
  if (!media || !validReferenceMediaUrl(url)) throw new Error('MEDIA_NOT_AVAILABLE');
  const storageKey = ownedMediaStorageKeyForUrl({ url, userId });
  // A row owned by the caller is not permission to sign another owner's storage object.
  if (extractStorageKeyFromUrl(url) && !storageKey) throw new Error('MEDIA_NOT_AVAILABLE');
  const authoredName = row.original_name ?? row.metadata?.originalName;
  const originalName = typeof authoredName === 'string' && authoredName.trim()
    ? authoredName.trim().slice(0, 1024)
    : undefined;
  return { id: row.id, ref, kind: ref.kind, url, thumbUrl: row.thumb_url ?? null,
    previewUrl: row.preview_url ?? null, mime: media.canonicalMime, mediaFacts: readMediaFacts(row.metadata?.mediaFacts),
    originalAccess: storageKey ? { type: 'owned-storage' as const, storageKey } : { type: 'external' as const },
    ...(originalName ? { originalName } : {}) };
}
