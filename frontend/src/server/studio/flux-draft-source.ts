import { query,type QueryExecutor } from '@/lib/db';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import { prepareOwnedFluxDraftSource } from '@/server/prepare-flux-draft-source';
import { resolveOwnedFluxDraftSource } from '@/server/flux-draft-cache-store';
/** Existing attached/project-media authorization must run first. */
export async function resolveStudioFluxDraftSource(userId:string,source:ToolAssetRef,executor:QueryExecutor={query},resolve:(input:Parameters<typeof resolveOwnedFluxDraftSource>[0])=>ReturnType<typeof resolveOwnedFluxDraftSource>=resolveOwnedFluxDraftSource) {
  if(source.kind!=='video')throw new Error('Select an owned native Draft output.');
  if(source.type==='job-output')return resolve({userId,sourceJobId:source.jobId,sourceOutputId:source.outputId,executor});
  const rows=await executor.query<{source_job_id:string;source_output_id:string}>(`SELECT source_job_id,source_output_id FROM media_assets WHERE public_id=$1 AND user_id=$2 AND status='ready' AND deleted_at IS NULL LIMIT 1`,[source.assetId,userId]);
  if(!rows[0]?.source_job_id||!rows[0].source_output_id)throw new Error('This video has no eligible Draft lineage.');
  return resolve({userId,sourceJobId:rows[0].source_job_id,sourceOutputId:rows[0].source_output_id,sourceAssetId:source.assetId,executor});
}

/** Called only by video.prepare after attached/project-output authorization. */
export async function prepareStudioFluxDraftSource(userId:string,source:ToolAssetRef,executor?:QueryExecutor,
  prepare:typeof prepareOwnedFluxDraftSource=prepareOwnedFluxDraftSource) {
  return resolveStudioFluxDraftSource(userId,source,executor,prepare);
}
