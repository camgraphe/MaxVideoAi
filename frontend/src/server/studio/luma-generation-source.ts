import { query, type QueryExecutor } from '@/lib/db';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import { AgentApiError } from '@/server/agent-api/errors';
import { resolveOwnedLumaGenerationSource } from '@/server/agent-api/generation-luma-lineage';
/** Called only after the normal attached-media/project-output check. No promotion or imported URL inference. */
export async function resolveStudioLumaGenerationSource(userId: string, source: ToolAssetRef, executor: QueryExecutor = { query }) {
  if (source.kind !== 'video') throw new AgentApiError('REFERENCE_INVALID', 'Select an owned completed Ray 3.2 video.');
  if (source.type === 'job-output') return resolveOwnedLumaGenerationSource({ actor: { userId }, sourceJobId: source.jobId, expectedOutputId: source.outputId, executor });
  const rows = await executor.query<{ source_job_id: string; source_output_id: string }>(
    `SELECT source_job_id, source_output_id FROM media_assets WHERE public_id = $1 AND user_id = $2
      AND status = 'ready' AND deleted_at IS NULL LIMIT 1`, [source.assetId, userId]);
  if (!rows[0]?.source_job_id || !rows[0].source_output_id) throw new AgentApiError('REFERENCE_INVALID', 'This media has no eligible generation lineage.');
  return resolveOwnedLumaGenerationSource({ actor: { userId }, sourceJobId: rows[0].source_job_id,
    expectedOutputId: rows[0].source_output_id, expectedOutputAssetId: source.assetId, executor });
}
