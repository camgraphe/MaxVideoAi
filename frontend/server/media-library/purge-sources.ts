import type { TransactionQueryExecutor } from '@/lib/db';
import type { OrganizationSource } from './organization-sources';
import { readPurgeSourcePlan, purgeSourcePlanFingerprint, consumeLockedPurgeSourcePlan, PURGE_JOB_FIELDS, type PurgeSourcePlan, type PurgeSourceFile } from './purge-source-plan';
export { readPurgeSourcePlan, purgeSourcePlanFingerprint } from './purge-source-plan';
export { readPurgeProjectionRetentionSql } from './purge-projection-retention';
export type { PurgeSourcePlan, PurgeSourceFile } from './purge-source-plan';

/** Only the already locked, proven source group is changed. Jobs and billing remain records. */
export async function tombstonePurgeSources(userId:string,sources:OrganizationSource[],tx:TransactionQueryExecutor,acceptedPlan?:PurgeSourcePlan):Promise<PurgeSourceFile[]> {
  const plan=await readPurgeSourcePlan(userId,sources,tx);
  if(acceptedPlan&&purgeSourcePlanFingerprint(plan)!==purgeSourcePlanFingerprint(acceptedPlan))throw new Error('PURGE_SOURCE_PLAN_CHANGED');
  return applyPurgeSourcePlan(userId,plan,tx);
}

/** Worker fast path: the plan must have been read and locked in this transaction. */
export async function applyPurgeSourcePlan(userId:string,plan:PurgeSourcePlan,tx:TransactionQueryExecutor):Promise<PurgeSourceFile[]> {
  consumeLockedPurgeSourcePlan(userId,plan,tx);
  const ids=(type:string)=>plan.sources.filter(source=>source.type===type).map(source=>source.id);
  await tx.query("UPDATE media_assets SET deleted_at=clock_timestamp(),status='deleted',updated_at=clock_timestamp() WHERE user_id=$1 AND id=ANY($2::text[])",[userId,ids('asset')]);
  await tx.query('DELETE FROM user_assets WHERE user_id=$1 AND asset_id=ANY($2::text[])',[userId,ids('legacy')]);
  await tx.query("UPDATE job_outputs SET status='deleted',updated_at=clock_timestamp() WHERE user_id=$1 AND id=ANY($2::text[])",[userId,ids('job-output')]);
  for(const projection of plan.jobs){
    const keys=PURGE_JOB_FIELDS.filter(key=>key in projection.after&&JSON.stringify(projection.before[key])!==JSON.stringify(projection.after[key]));
    const values=keys.map(key=>['render_ids','keyframe_urls'].includes(key)&&projection.after[key]!==null?JSON.stringify(projection.after[key]):projection.after[key]);
    await tx.query(`UPDATE app_jobs SET ${keys.map((key,index)=>`${key}=$${index+3}${['render_ids','keyframe_urls'].includes(key)?'::jsonb':''}`).join(',')},updated_at=clock_timestamp() WHERE user_id=$1 AND job_id=$2`,[userId,projection.jobId,...values]);
  }
  // A Character base remains a neutral container for its independent looks; its
  // cascading foreign key must never delete those separate generated originals.
  for(const projection of plan.characters)await tx.query(`UPDATE ${projection.table} SET image_url=$3,thumb_url=$4 WHERE user_id::text=$1 AND id=$2::bigint`,[userId,projection.id,projection.after.image_url,projection.after.thumb_url]);
  // Unproven copies keep their provenance and bytes but become manageable cards.
  if(plan.retainedPrepared.length)await tx.query(`UPDATE media_assets m SET metadata=COALESCE(m.metadata,'{}'::jsonb)||
    jsonb_build_object('libraryPurgeRetained',jsonb_build_object('version',1,'reason',retained.reason)),updated_at=clock_timestamp()
    FROM jsonb_to_recordset($2::jsonb) AS retained(id text,"assetId" text,reason text)
    WHERE m.user_id=$1 AND m.id=retained.id AND m.public_id=retained."assetId" AND m.deleted_at IS NULL AND m.status='ready'`,[userId,JSON.stringify(plan.retainedPrepared)]);
  return plan.files;
}
