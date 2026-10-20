import { query, type QueryExecutor } from '@/lib/db';
import { readMediaFacts, type MediaFacts } from '@/lib/media-identity';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';
import { validReferenceMediaUrl } from '@/server/agent-api/reference-assets';
import { resolveSupportedReferenceMedia } from '@/server/agent-api/reference-media-policy';
import { inspectSourceVideo } from '@/server/audio/source-video-probe';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';

// Ready generated originals can exceed the private upload envelope. Qualification
// has its own fixed bound while retaining the shared transport and probe guards.
const downloadOwnedVideoFactsSource = createBoundedMediaDownloader({
  accepted: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
  maxBytes: 100 * 1024 * 1024,
});

type VideoRow = {
  id: string; public_id?: string; job_id?: string; user_id: string; kind: string; status: string;
  url: string; storage_url?: string | null; mime_type?: string | null; metadata?: Record<string, unknown>;
  deleted_at?: unknown; hidden?: boolean; job_user_id?: string | null; job_status?: string;
  source_job_id?: string | null; source_output_id?: string | null; source_output_user_id?: string | null;
  source_output_status?: string | null; source_output_job_id?: string | null;
};
export type OwnedVideoFactsInput = { userId: string; ref: ToolAssetRef; expectedUrl?: string };
export type OwnedVideoFactsDependencies = { query?: QueryExecutor['query']; inspectVideo?: typeof inspectSourceVideo; createReadUrl?: typeof createOwnedMediaReadUrl };

function completeFacts(value: unknown): MediaFacts | undefined {
  const facts = readMediaFacts(value);
  return facts?.source === 'probe' && facts.durationSec && facts.width && facts.height && typeof facts.hasAudio === 'boolean' ? facts : undefined;
}

/** Actual original bytes only. Call outside editor transactions; persist no temporary read grants. */
export async function hydrateOwnedVideoMediaFacts(input: OwnedVideoFactsInput, dependencies: OwnedVideoFactsDependencies = {}): Promise<MediaFacts> {
  if (!input.userId || input.userId !== input.userId.trim()) throw new Error('UNAUTHORIZED');
  const ref = toolAssetRefSchema.parse(input.ref);
  if (ref.kind !== 'video') throw new Error('MEDIA_NOT_AVAILABLE');
  const execute = dependencies.query ?? query;
  const rows = ref.type === 'job-output'
    ? await execute<VideoRow>(`SELECT o.*, j.user_id AS job_user_id, j.status AS job_status, j.hidden
        FROM job_outputs o JOIN app_jobs j ON j.job_id = o.job_id AND j.user_id = o.user_id
        WHERE o.user_id = $1 AND j.user_id = $1 AND o.id = $2 AND o.job_id = $3
          AND o.kind = 'video' AND o.status = 'ready' AND j.status = 'completed' AND j.hidden IS NOT TRUE`, [input.userId, ref.outputId, ref.jobId])
    : await execute<VideoRow>(`SELECT a.*, j.user_id AS job_user_id, j.hidden,
        source_output.user_id AS source_output_user_id, source_output.status AS source_output_status,
        source_output.job_id AS source_output_job_id
        FROM media_assets a LEFT JOIN job_outputs source_output ON source_output.id = a.source_output_id
        LEFT JOIN app_jobs j ON j.job_id = COALESCE(a.source_job_id, source_output.job_id)
        WHERE a.user_id = $1 AND a.public_id = $2 AND a.kind = 'video' AND a.status = 'ready'
          AND a.deleted_at IS NULL AND j.hidden IS NOT TRUE
          AND (a.source_job_id IS NULL OR j.user_id = $1)
          AND (a.source_output_id IS NULL OR (source_output.user_id = $1 AND source_output.status = 'ready'
            AND j.user_id = $1 AND (a.source_job_id IS NULL OR a.source_job_id = source_output.job_id)))`, [input.userId, ref.assetId]);
  const row = rows[0];
  if (!row || row.user_id !== input.userId || row.kind !== 'video' || row.status !== 'ready' || row.deleted_at || row.hidden
    || (row.job_user_id && row.job_user_id !== input.userId)
    || (ref.type === 'job-output' ? row.id !== ref.outputId || row.job_id !== ref.jobId || row.job_status !== 'completed'
      : row.public_id !== ref.assetId || (row.source_job_id && row.job_user_id !== input.userId)
        || (row.source_output_id && (row.source_output_user_id !== input.userId || row.source_output_status !== 'ready'
          || row.job_user_id !== input.userId || (row.source_job_id && row.source_job_id !== row.source_output_job_id))))) {
    throw new Error('MEDIA_NOT_AVAILABLE');
  }
  const url = row.storage_url || row.url;
  if (!validReferenceMediaUrl(url) || !resolveSupportedReferenceMedia('video', row.mime_type)
    || (input.expectedUrl !== undefined && input.expectedUrl !== url)) throw new Error('MEDIA_NOT_AVAILABLE');
  // Storage ownership is enforced even if a row already has facts.
  const readUrl = await (dependencies.createReadUrl ?? createOwnedMediaReadUrl)({ userId: input.userId, url });
  const existing = completeFacts(row.metadata?.mediaFacts);
  if (existing) return existing;
  let facts: MediaFacts | undefined;
  try {
    const inspectVideo = dependencies.inspectVideo ?? (url => inspectSourceVideo(url, { download: downloadOwnedVideoFactsSource }));
    facts = completeFacts({ source: 'probe', ...await inspectVideo(readUrl) });
  } catch {
    // Downloader/ffprobe failures may include the signed input; expose no cause or command.
    throw new Error('MEDIA_METADATA_REQUIRED');
  }
  if (!facts) throw new Error('MEDIA_METADATA_REQUIRED');
  const measuredJson = JSON.stringify(facts);
  const persisted = ref.type === 'job-output'
    ? await execute<{ id: string }>(`WITH measured AS (
        UPDATE job_outputs o SET metadata = COALESCE(o.metadata, '{}'::jsonb) || jsonb_build_object('mediaFacts', $5::jsonb),
          width = ($5::jsonb->>'width')::integer, height = ($5::jsonb->>'height')::integer, updated_at = NOW()
        FROM app_jobs j WHERE o.id = $2 AND o.job_id = $3 AND o.user_id = $1 AND j.job_id = o.job_id
          AND j.user_id = $1 AND j.status = 'completed' AND j.hidden IS NOT TRUE
          AND o.kind = 'video' AND o.status = 'ready' AND COALESCE(o.storage_url, o.url) = $4
        RETURNING o.id, o.user_id, o.job_id
      ), promoted AS (
        UPDATE media_assets a SET metadata = COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object('mediaFacts', $5::jsonb),
          width = ($5::jsonb->>'width')::integer, height = ($5::jsonb->>'height')::integer, updated_at = NOW()
        FROM measured WHERE a.source_output_id = measured.id AND a.user_id = measured.user_id
          AND (a.source_job_id IS NULL OR a.source_job_id = measured.job_id)
          AND a.kind = 'video' AND a.status = 'ready' AND a.deleted_at IS NULL
          AND (a.url = $4 OR a.metadata->>'originUrl' = $4)
        RETURNING a.id
      ) SELECT id FROM measured`, [input.userId, row.id, ref.jobId, url, measuredJson])
    : await execute<{ id: string }>(`UPDATE media_assets a
        SET metadata = COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object('mediaFacts', $4::jsonb),
          width = ($4::jsonb->>'width')::integer, height = ($4::jsonb->>'height')::integer, updated_at = NOW()
        WHERE a.id = $2 AND a.user_id = $1 AND a.url = $3
          AND a.kind = 'video' AND a.status = 'ready' AND a.deleted_at IS NULL
          AND (a.source_job_id IS NULL OR EXISTS (SELECT 1 FROM app_jobs j
            WHERE j.job_id = a.source_job_id AND j.user_id = $1 AND j.hidden IS NOT TRUE))
          AND (a.source_output_id IS NULL OR EXISTS (SELECT 1 FROM job_outputs source_output
            JOIN app_jobs j ON j.job_id = source_output.job_id AND j.user_id = source_output.user_id
            WHERE source_output.id = a.source_output_id AND source_output.user_id = $1 AND source_output.status = 'ready'
              AND j.user_id = $1 AND j.hidden IS NOT TRUE
              AND (a.source_job_id IS NULL OR a.source_job_id = source_output.job_id)))
        RETURNING a.id`, [input.userId, row.id, url, measuredJson]);
  if (persisted.length !== 1) throw new Error('MEDIA_NOT_AVAILABLE');
  return facts;
}
