import { query } from '@/lib/db';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';
import { readMediaFacts } from '@/lib/media-identity';
import { validReferenceMediaUrl } from '@/server/agent-api/reference-assets';
import { resolveSupportedReferenceMedia } from '@/server/agent-api/reference-media-policy';
import { extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl } from '@/server/storage';
import {videoDuration} from '@/lib/generated-video-media-facts';
import {getStorageObjectMetadata} from '@/server/storage';
import {completeStudioOutputReferenceFacts,type StudioReferenceMetadataHead} from './output-reference-facts';

type MediaRow = { id: string; public_id?: string; job_id?: string; user_id: string; kind: string; url: string; storage_url?: string | null; thumb_url?: string | null; preview_url?: string | null; mime_type?: string | null; original_name?: string | null; size_bytes?: number | string | null; width?: number | null; height?: number | null; metadata?: Record<string, unknown>; status: string; deleted_at?: unknown; hidden?: boolean; job_user_id?: string; source_job_id?: string | null; source_output_id?: string | null };
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
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
};

/** Read-only exact owner lookup. No schema creation, ensure, copy or caller-supplied URL. */
export async function resolveStudioMedia(
  userId: string,
  input: unknown,
  execute: StudioMediaExecutor = query,
  options: { lockAsset?: boolean; completeReferenceFacts?: boolean; referenceFactsSignal?: AbortSignal; headReferenceMetadata?: StudioReferenceMetadataHead } = {},
): Promise<StudioResolvedMedia> {
  if (!userId) throw new Error('UNAUTHORIZED');
  const ref = toolAssetRefSchema.parse(input);
  const readRows = async () => ref.type === 'asset'
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
  const rows=await readRows();
  const row = rows[0];
  if (!row || row.user_id !== userId || row.kind !== ref.kind || row.status !== 'ready' || row.deleted_at || row.hidden
    || (row.job_user_id && row.job_user_id !== userId)
    || (ref.type === 'asset' ? row.public_id !== ref.assetId : row.id !== ref.outputId || row.job_id !== ref.jobId)) {
    throw new Error('MEDIA_NOT_AVAILABLE');
  }
  if (options.lockAsset && ref.type === 'asset' && (row.source_job_id || row.source_output_id)) {
    const lockedSources = row.source_output_id
      ? await execute(`SELECT o.id FROM job_outputs o
          JOIN app_jobs j ON j.job_id = o.job_id
          WHERE o.id = $2 AND o.user_id = $1 AND o.status = 'ready'
            AND j.user_id = $1 AND j.hidden IS NOT TRUE
            AND ($3 = '' OR o.job_id = $3)
          FOR SHARE OF o, j`, [userId, row.source_output_id, row.source_job_id ?? ''])
      : await execute(`SELECT j.job_id AS id FROM app_jobs j
          WHERE j.job_id = $2 AND j.user_id = $1 AND j.hidden IS NOT TRUE
          FOR SHARE OF j`, [userId, row.source_job_id ?? '']);
    if (!lockedSources[0]) throw new Error('MEDIA_NOT_AVAILABLE');
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
  const mediaFacts=readMediaFacts(row.metadata?.mediaFacts);
  const duration=ref.type==='asset'&&ref.kind==='video'?videoDuration(row.metadata??{},url,typeof row.metadata?.durationSec==='number'?row.metadata.durationSec:null):mediaFacts?.durationSec??(ref.type==='asset'&&ref.kind==='audio'&&typeof row.metadata?.durationSec==='number'?row.metadata.durationSec:null);
  const bytes=Number(row.size_bytes);
  const result:StudioResolvedMedia = { id: row.id, ref, kind: ref.kind, url, thumbUrl: row.thumb_url ?? null,
    previewUrl: row.preview_url ?? null, mime: media.canonicalMime, mediaFacts,
    sizeBytes:Number.isSafeInteger(bytes)&&bytes>0?bytes:null,width:row.width??mediaFacts?.width??null,height:row.height??mediaFacts?.height??null,durationSec:typeof duration==='number'&&Number.isFinite(duration)&&duration>0?duration:null,
    originalAccess: storageKey ? { type: 'owned-storage' as const, storageKey } : { type: 'external' as const },
    ...(originalName ? { originalName } : {}) };
  if(options.completeReferenceFacts&&ref.type==='job-output') {
    const signal=options.referenceFactsSignal??AbortSignal.timeout(8_000);
    const sourceSnapshot=JSON.stringify(row);
    const facts=await completeStudioOutputReferenceFacts(row,signal,{
      readSaved:async()=>{
        const saved=await execute(`SELECT a.* FROM media_assets a
          WHERE a.user_id = $1 AND a.source_job_id = $2 AND a.source_output_id = $3 AND a.kind = $4
            AND a.status = 'ready' AND a.deleted_at IS NULL
            AND (a.url = $5 OR a.metadata->>'originUrl' = $5) LIMIT 1`,[userId,ref.jobId,ref.outputId,ref.kind,url]);
        return saved[0]??null;
      },
      head:options.headReferenceMetadata??getStorageObjectMetadata,
    });
    signal.throwIfAborted();
    // A slow metadata read cannot authorize a changed, hidden, deleted or foreign output.
    const current=(await readRows())[0];
    signal.throwIfAborted();
    if(!current||JSON.stringify(current)!==sourceSnapshot)throw new Error('MEDIA_NOT_AVAILABLE');
    Object.assign(result,facts);
  }
  return result;
}
