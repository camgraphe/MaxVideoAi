import { query, type QueryExecutor } from '@/lib/db';
import {
  mapOutputRow,
  type DbJobOutputRow,
  type JobOutputRecord,
} from '@/server/media-library-records';
import { ensureReusableAsset } from './assets';

export type McpOutputLibraryPromotionDependencies = {
  executor: QueryExecutor;
  ensureReusableAsset: typeof ensureReusableAsset;
};

export type McpOutputLibraryPromotionResult = {
  promoted: number;
  failed: number;
  skipped: number;
};

const defaultDependencies: McpOutputLibraryPromotionDependencies = {
  executor: { query },
  ensureReusableAsset,
};

function isPromotableOutput(output: JobOutputRecord): output is JobOutputRecord & { userId: string } {
  return (
    output.status === 'ready'
    && typeof output.userId === 'string'
    && output.userId.length > 0
    && output.userId === output.userId.trim()
    && typeof output.url === 'string'
    && output.url.length > 0
  );
}

export async function promoteCompletedMcpJobOutputs(
  outputs: JobOutputRecord[],
  dependencies: McpOutputLibraryPromotionDependencies = defaultDependencies,
): Promise<McpOutputLibraryPromotionResult> {
  const groups = new Map<string, Array<JobOutputRecord & { userId: string }>>();
  let skipped = 0;
  for (const output of outputs) {
    if (!isPromotableOutput(output)) {
      skipped += 1;
      continue;
    }
    const key = `${output.userId}\u0000${output.jobId}`;
    const group = groups.get(key) ?? [];
    group.push(output);
    groups.set(key, group);
  }

  let promoted = 0;
  let failed = 0;
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const acceptedQuotes = await dependencies.executor.query<{ job_id: string }>(
      `SELECT job_id
         FROM mcp_generation_quotes
        WHERE job_id = $1
          AND user_id = $2
          AND state = 'accepted'
        LIMIT 1`,
      [first.jobId, first.userId],
    );
    if (!acceptedQuotes.length) {
      skipped += group.length;
      continue;
    }

    const results = await Promise.allSettled(
      group.map((output) => dependencies.ensureReusableAsset({
        userId: output.userId,
        url: output.url,
        kind: output.kind,
        source: 'saved_job_output',
        sourceJobId: output.jobId,
        sourceOutputId: output.id,
        mimeType: output.mimeType,
        width: output.width,
        height: output.height,
        durationSec: output.durationSec,
        thumbUrl: output.thumbUrl,
        previewUrl: output.previewUrl,
        metadata: { mcpGenerated: true },
      })),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') promoted += 1;
      else failed += 1;
    }
  }

  return { promoted, failed, skipped };
}

export async function backfillCompletedMcpJobOutputs(
  options: { limit?: number } = {},
  dependencies: McpOutputLibraryPromotionDependencies = defaultDependencies,
): Promise<McpOutputLibraryPromotionResult> {
  const limit = Math.min(20, Math.max(1, options.limit ?? 5));
  const rows = await dependencies.executor.query<DbJobOutputRow>(
    `SELECT o.id, o.job_id, o.user_id, o.kind, o.url, o.storage_url, o.thumb_url, o.preview_url,
            o.mime_type, o.width, o.height, o.duration_sec, o.position, o.status, o.metadata, o.created_at
       FROM job_outputs o
       JOIN mcp_generation_quotes quote
         ON quote.job_id = o.job_id
        AND quote.user_id = o.user_id
        AND quote.state = 'accepted'
       LEFT JOIN media_assets saved
         ON saved.user_id = o.user_id
        AND saved.source_output_id = o.id
        AND saved.deleted_at IS NULL
      WHERE o.status = 'ready'
        AND o.user_id IS NOT NULL
        AND saved.id IS NULL
      ORDER BY o.created_at ASC
      LIMIT $1`,
    [limit],
  );
  return promoteCompletedMcpJobOutputs(rows.map(mapOutputRow), dependencies);
}
