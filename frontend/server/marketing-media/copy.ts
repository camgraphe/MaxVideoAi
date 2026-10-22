import { randomUUID } from 'node:crypto';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { completeMarketingSnapshot, MarketingMediaError, marketingSourceFingerprint, prepareMarketingSnapshot } from './snapshot';
import { marketingItem, readMarketingRow, readMarketingSource, type MarketingRow } from './store';
import { copyMarketingMediaFile } from './storage';
import type { MarketingMediaFile } from '@/lib/marketing-media';

type PromotionDependencies = {
 db:QueryExecutor;
 transaction:<T>(run:(db:QueryExecutor)=>Promise<T>)=>Promise<T>;
 copyFile:typeof copyMarketingMediaFile;
};
const defaults:PromotionDependencies={db:{query},transaction:withDbTransaction,copyFile:copyMarketingMediaFile};
export async function promoteMarketingVideo(input:{videoId:string;actorId:string;permissionConfirmed:boolean},dependencies:PromotionDependencies=defaults){
 if(!input.actorId || !input.videoId.trim() || input.videoId.length>256)throw new MarketingMediaError('Invalid video selection.');
 const claim=await dependencies.transaction(async db=>{
  await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,['marketing-media:'+input.videoId]);
  const previous=await readMarketingRow(input.videoId,db,true);
  if(previous?.state==='ready')return{ready:previous};
  if(previous?.state==='deleting' || (previous?.state==='copying' && previous.lease_until && new Date(previous.lease_until).getTime()>Date.now()))throw new MarketingMediaError('A copy is already in progress.',409);
  const source=await readMarketingSource(input.videoId,db);
  if(!source)throw new MarketingMediaError('The original video is unavailable.',404);
  const plan=prepareMarketingSnapshot(source);
  if(plan.ownerId!==input.actorId && !input.permissionConfirmed)throw new MarketingMediaError('Confirm permission to publish this video and its references.',403);
  const attemptId=randomUUID();const copyId=previous?.copy_id??randomUUID();
  await db.query(`INSERT INTO marketing_media(video_id,copy_id,state,source_user_id,source_fingerprint,source_snapshot,source_record,attempt_id,lease_until,copied_by,permission_confirmed)
   VALUES($1,$2,'copying',$3,$4,$5,$6,$7,now()+interval '5 minutes',$8,$9)
   ON CONFLICT(video_id) DO UPDATE SET state='copying',source_user_id=EXCLUDED.source_user_id,source_fingerprint=EXCLUDED.source_fingerprint,
    source_snapshot=EXCLUDED.source_snapshot,source_record=EXCLUDED.source_record,attempt_id=EXCLUDED.attempt_id,lease_until=EXCLUDED.lease_until,
    copied_by=EXCLUDED.copied_by,permission_confirmed=EXCLUDED.permission_confirmed,last_error=NULL,updated_at=now()`,
   [input.videoId,copyId,plan.ownerId,plan.fingerprint,JSON.stringify(plan.sourceSnapshot),JSON.stringify(source),attemptId,input.actorId,input.permissionConfirmed]);
  return{plan,attemptId,copyId};
 });
 if(claim.ready)return marketingItem(claim.ready);
 const {plan,attemptId,copyId}=claim;
 const files:MarketingMediaFile[]=[];let remainingBytes=512*1024**2;const signal=AbortSignal.timeout(180_000);
 try {
  for(const file of plan.media){
   const copied=await dependencies.copyFile(file,{copyId,ownerId:plan.ownerId,remainingBytes,signal});
   files.push(copied);remainingBytes-=copied.sizeBytes;
   if(remainingBytes<0)throw new MarketingMediaError('This publication exceeds the total copy size limit.');
   const progress=await dependencies.db.query(`UPDATE marketing_media SET files=$3,size_bytes=$4,updated_at=now()
    WHERE video_id=$1 AND attempt_id=$2 AND state='copying' AND lease_until>now() RETURNING video_id`,[input.videoId,attemptId,JSON.stringify(files),512*1024**2-remainingBytes]);
   if(!progress.length)throw new MarketingMediaError('This copy attempt is no longer current.',409);
  }
  const completed=completeMarketingSnapshot(plan,files);
  const ready=await dependencies.transaction(async db=>{
   // Protect against new deletion tombstones as well as updates to existing source rows.
   await db.query('SET LOCAL lock_timeout=\'2s\'');
   await db.query('LOCK TABLE app_jobs,job_outputs,media_assets IN SHARE MODE NOWAIT');
   const row=await readMarketingRow(input.videoId,db,true);
   const source=await readMarketingSource(input.videoId,db);
   if(!row || row.state!=='copying' || row.attempt_id!==attemptId || !source || marketingSourceFingerprint(source)!==plan.fingerprint)
    throw new MarketingMediaError('The source changed or is unavailable. Retry the copy.',409);
   const rows=await db.query<MarketingRow>(`UPDATE marketing_media SET state='ready',publication=$3,recreation_snapshot=$4,files=$5,size_bytes=$6,
    lease_until=NULL,last_error=NULL,updated_at=now() WHERE video_id=$1 AND attempt_id=$2 RETURNING *`,
    [input.videoId,attemptId,JSON.stringify(completed.publication),JSON.stringify(completed.recreationSnapshot),JSON.stringify(files),completed.sizeBytes]);
   return rows[0];
  });
  return marketingItem(ready);
 }catch(error){
  const message=error instanceof MarketingMediaError?error.message:'The complete media copy failed. Retry when all source files are available.';
  await dependencies.db.query(`UPDATE marketing_media SET state='failed',last_error=$3,lease_until=NULL,updated_at=now()
   WHERE video_id=$1 AND attempt_id=$2 AND state='copying'`,[input.videoId,attemptId,message]);
  throw error instanceof MarketingMediaError?error:new MarketingMediaError(message,502);
 }
}
