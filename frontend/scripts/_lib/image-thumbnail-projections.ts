import type { ImageRenderEntry } from '../../lib/image-renders';
import { buildStoredImageRenderEntries, parseStoredImageRenders } from '../../lib/image-renders';
import { normalizeMediaUrl } from '../../lib/media';
import type { QueryExecutor } from '../../src/lib/db';
import type { BackfillRow } from './image-thumbnail-backfill';

type Table = 'job_outputs' | 'media_assets' | 'user_assets';
type Projection = {
  table_name: Table;
  id: string;
  url: string;
  thumb_url: string | null;
  metadata_thumb_url: string | null;
  metadata_editable: boolean;
  position: number | null;
  source_output_id: string | null;
  snapshot: string;
};
type Repair = { projection: Projection; thumbnail: string | null; column: boolean; metadata: boolean };

export type ImageThumbnailProjectionRepair = {
  inspect(row: BackfillRow): Promise<number>;
  repair(row: BackfillRow, entries: ImageRenderEntry[]): Promise<number>;
};

type Dependencies = QueryExecutor & {
  transaction<T>(work: (executor: QueryExecutor) => Promise<T>): Promise<T>;
};

const MAX_ROWS_PER_TABLE = 1000;

function validThumbnail(original: string, thumbnail: string | null | undefined): string | null {
  const normalized = normalizeMediaUrl(thumbnail);
  return normalized && normalized !== normalizeMediaUrl(original) ? thumbnail! : null;
}

async function loadProjections(query: QueryExecutor['query'], row: BackfillRow): Promise<Projection[]> {
  const params = [row.job_id, row.user_id, MAX_ROWS_PER_TABLE + 1];
  const outputs = await query<Projection>(
    `SELECT 'job_outputs' AS table_name, o.id::text AS id, o.url, o.thumb_url,
            NULL::text AS metadata_thumb_url, false AS metadata_editable,
            o.position, NULL::text AS source_output_id, to_jsonb(o)::text AS snapshot
       FROM job_outputs o
      WHERE o.job_id = $1 AND o.user_id IS NOT DISTINCT FROM $2::text
        AND o.kind = 'image' AND o.status <> 'deleted'
      ORDER BY o.id LIMIT $3`, params
  );
  const assets = await query<Projection>(
    `SELECT 'media_assets' AS table_name, a.id::text AS id, a.url, a.thumb_url,
            a.metadata->>'thumbUrl' AS metadata_thumb_url,
            COALESCE(jsonb_typeof(a.metadata) = 'object', true) AS metadata_editable,
            NULL::integer AS position, a.source_output_id, to_jsonb(a)::text AS snapshot
       FROM media_assets a
      WHERE a.user_id IS NOT DISTINCT FROM $2::text AND a.kind = 'image'
        AND a.deleted_at IS NULL AND a.status <> 'deleted'
        AND (a.source_job_id = $1 OR (a.source_job_id IS NULL AND EXISTS (
          SELECT 1 FROM job_outputs o WHERE o.id = a.source_output_id AND o.job_id = $1
            AND o.user_id IS NOT DISTINCT FROM $2::text AND o.kind = 'image' AND o.status <> 'deleted'
        )))
      ORDER BY a.id LIMIT $3`, params
  );
  const legacy = await query<Projection>(
    `SELECT 'user_assets' AS table_name, a.id::text AS id, a.url,
            NULL::text AS thumb_url, a.metadata->>'thumbUrl' AS metadata_thumb_url,
            true AS metadata_editable, NULL::integer AS position,
            NULL::text AS source_output_id, to_jsonb(a)::text AS snapshot
       FROM user_assets a
      WHERE a.user_id IS NOT DISTINCT FROM $2::text
        AND COALESCE(a.metadata->>'jobId', a.metadata->>'sourceJobId') = $1
        AND LOWER(COALESCE(a.mime_type, '')) NOT LIKE 'video/%'
        AND LOWER(COALESCE(a.mime_type, '')) NOT LIKE 'audio/%'
        AND split_part(split_part(a.url, '?', 1), '#', 1) !~* '[.](mp4|webm|mov|m4v|avi|mkv|mp3|wav|ogg|m4a|aac|flac)$'
      ORDER BY a.id LIMIT $3`, params
  );
  if ([outputs, assets, legacy].some((records) => records.length > MAX_ROWS_PER_TABLE)) {
    throw new Error(`Image projection inventory exceeds ${MAX_ROWS_PER_TABLE} rows per table for one job`);
  }
  return [...outputs, ...assets, ...legacy];
}

function planRepairs(projections: Projection[], entries: ImageRenderEntry[]): Repair[] {
  const matches = (url: string, entry: ImageRenderEntry) => normalizeMediaUrl(url) === entry.url;
  return projections.flatMap((projection): Repair[] => {
    const columnThumb = validThumbnail(projection.url, projection.thumb_url);
    const metadataThumb = validThumbnail(projection.url, projection.metadata_thumb_url);
    const column = projection.table_name !== 'user_assets' && !columnThumb;
    const metadata = projection.metadata_editable && !metadataThumb;
    if (!column && !metadata) return [];

    let candidates: ImageRenderEntry[];
    if (projection.table_name === 'job_outputs') {
      const entry = projection.position === null ? undefined : entries[projection.position];
      candidates = entry && matches(projection.url, entry) ? [entry] : [];
    } else if (projection.source_output_id) {
      const output = projections.find((item) => item.table_name === 'job_outputs' && item.id === projection.source_output_id);
      const entry = output?.position === null || output?.position === undefined ? undefined : entries[output.position];
      candidates = output && entry && matches(output.url, entry) && matches(projection.url, entry) ? [entry] : [];
    } else {
      candidates = entries.filter((entry) => matches(projection.url, entry));
    }
    const thumbnails = new Set(candidates.map((entry) => validThumbnail(entry.url, entry.thumbUrl)).filter(Boolean));
    const thumbnail = columnThumb ?? metadataThumb ?? (thumbnails.size === 1 ? [...thumbnails][0]! : null);
    return [{ projection, thumbnail, column, metadata }];
  });
}

async function applyRepair(executor: QueryExecutor, repair: Repair): Promise<void> {
  const { projection, thumbnail, column, metadata } = repair;
  if (!thumbnail) throw new Error(`Cannot unambiguously map image thumbnail for ${projection.table_name} ${projection.id}`);
  const metadataSql = "metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{thumbUrl}', to_jsonb($2::text), true)";
  // Table names and assignments come only from these fixed script-owned branches.
  const updates: Record<Table, string[]> = {
    job_outputs: ['thumb_url = $2::text', 'updated_at = NOW()'],
    media_assets: [...(column ? ['thumb_url = $2::text'] : []), ...(metadata ? [metadataSql] : []), 'updated_at = NOW()'],
    user_assets: [metadataSql],
  };
  const rows = await executor.query<{ id: string }>(
    `UPDATE ${projection.table_name} AS target SET ${updates[projection.table_name].join(', ')}
      WHERE id = $1 AND to_jsonb(target) IS NOT DISTINCT FROM $3::jsonb RETURNING id`,
    [projection.id, thumbnail, projection.snapshot]
  );
  if (rows.length !== 1) throw new Error('Image projection changed during repair');
}

export function createImageThumbnailProjectionRepair(dependencies: Dependencies): ImageThumbnailProjectionRepair {
  return {
    async inspect(row) {
      const projections = await loadProjections(dependencies.query, row);
      return planRepairs(projections, parseStoredImageRenders(row.render_ids).entries).length;
    },
    async repair(row, entries) {
      return dependencies.transaction(async (executor) => {
        await executor.query("SET LOCAL statement_timeout = '15s'");
        await executor.query("SET LOCAL lock_timeout = '2s'");
        // Hold the source stable while applying its references, after slow encoding/storage has finished.
        const current = await executor.query<BackfillRow>(
          `SELECT id, job_id, user_id, thumb_url, render_ids, updated_at::text AS updated_at
             FROM app_jobs WHERE id = $1 AND job_id = $2
               AND user_id IS NOT DISTINCT FROM $3::text AND hidden IS NOT TRUE AND video_url IS NULL
             FOR SHARE`, [row.id, row.job_id, row.user_id]
        );
        if (current.length !== 1 || JSON.stringify(buildStoredImageRenderEntries(parseStoredImageRenders(current[0]!.render_ids).entries)) !== JSON.stringify(buildStoredImageRenderEntries(entries))) {
          throw new Error('Image source changed before projection repair');
        }
        const projections = await loadProjections(executor.query, row);
        const repairs = planRepairs(projections, entries);
        if (repairs.some((repair) => !repair.thumbnail)) throw new Error('Image projection has an ambiguous or unmatched original');
        for (const repair of repairs) await applyRepair(executor, repair);
        return repairs.length;
      });
    },
  };
}
