import { query } from '@/lib/db';
import type { CreatorOperationResult } from '@/lib/toolbox/creator-tools';
import { withCreatorMediaReadAccess } from '@/server/tools/creator-media-access';

type Read = <T>(sql: string, params?: unknown[]) => Promise<T[]>;
export type ModerationToolResult = {
  outputs?: PresentedOutput[];
  ref?: { type: 'asset'; assetId: string; kind: 'video' | 'image' | 'audio' };
  originalUrl?: string;
  readUrl?: string | null;
  thumbnailReadUrl?: string | null;
  durationSec?: number;
};
type CreatorRow = { job_id: string; user_id: string; status: string; result: ModerationToolResult | null };
type PresentedOutput = CreatorOperationResult['outputs'][number] & { readUrl?: string | null; thumbnailReadUrl?: string | null };
type Present = (userId: string, value: { result: ModerationToolResult | null }) => Promise<{ result: ModerationToolResult | null }>;

/** Creator finalization may replace/mux the model output without rewriting app_jobs. */
export async function readModerationCreatorResults(
  jobIds: string[],
  toolId: string,
  read: Read = query,
  present: Present = withCreatorMediaReadAccess
) {
  const sql = toolId === 'subtitles'
    ? `SELECT job_id, user_id, status, settings_snapshot->'subtitleResult' AS result
       FROM app_jobs WHERE job_id = ANY($1::text[]) AND settings_snapshot->>'toolId' = $2`
    : `SELECT q.job_id, o.user_id, o.status, o.result
       FROM creator_operations o
       JOIN mcp_generation_quotes q ON q.quote_id = o.id AND q.user_id = o.user_id
       JOIN app_jobs j ON j.job_id = q.job_id AND j.user_id = o.user_id
       WHERE q.job_id = ANY($1::text[]) AND o.tool_id = $2`;
  const rows = jobIds.length ? await read<CreatorRow>(sql, [jobIds, toolId]) : [];
  async function project(row: CreatorRow) {
    const presented = row.status === 'completed' && row.result ? await present(row.user_id, { result: row.result }) : null;
    const result = presented?.result;
    const output = result?.outputs?.[0] ?? (result?.ref ? {
      kind: result.ref.kind,
      readUrl: result.readUrl,
      thumbnailReadUrl: result.thumbnailReadUrl,
      durationSec: result.durationSec,
    } : undefined);
    // Never fall back to a private canonical URL if ownership/signing is unavailable.
    const originalUrl = output?.readUrl ?? null;
    return [row.job_id, {
      status: row.status === 'prepared' ? 'running' : row.status,
      originalUrl,
      videoUrl: output?.kind === 'video' ? originalUrl : null,
      thumbUrl: output?.thumbnailReadUrl ?? (output?.kind === 'image' ? originalUrl : null),
      durationSec: output?.durationSec,
    }] as const;
  }
  const entries: Array<Awaited<ReturnType<typeof project>>> = [];
  for (let offset = 0; offset < rows.length; offset += 4) {
    entries.push(...await Promise.all(rows.slice(offset, offset + 4).map(project)));
  }
  return new Map(entries);
}
