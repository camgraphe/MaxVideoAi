import { randomUUID } from 'node:crypto';
import { query, withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import { deleteStorageObjectKey, isOwnedMediaStorageKey, ownedMediaStorageKeyForUrl } from '@/server/storage';
import { resolveOrganizationBatch } from './organization-resolver';
import type { OrganizationSource } from './organization-sources';
import { readPurgeSourcePlan, applyPurgeSourcePlan, type PurgeSourceFile } from './purge-sources';
import { purgeSourceTokens, purgeTokenHashes } from './purge-tokens';
import { readPurgeProjectionRetentionSql } from './purge-projection-retention';
import { purgeFenceTable } from './purge-fences';

type RequestRow = {
  user_id: string; organization_key: string; reference: LibraryMediaReference;
  source_revision: string; sources: OrganizationSource[]; state: string; not_before: Date;
};
const workPredicates = {
  app_jobs: "lower(btrim(COALESCE(status,'unknown'))) NOT IN ('completed','finished','success','succeeded','failed','cancelled','canceled','error','errored','aborted')",
  app_timeline_exports: "lower(btrim(COALESCE(status,'unknown'))) NOT IN ('completed','finished','success','succeeded','failed','cancelled','canceled','error','errored','aborted')",
  creator_operations: "library_work_is_active('creator_operations',to_jsonb(work))",
  subtitle_operations: "COALESCE(state,'unknown') NOT IN ('prepared','completed','failed','cancelled','canceled')",
  studio_media_analysis_runs: "state IN ('queued','running','unknown')",
  studio_tasks: "state IN ('queued','running','unknown')",
  studio_image_turns: "state='thinking' AND lease_expires_at>clock_timestamp()",
} as const;
type WorkTable = keyof typeof workPredicates;

function ownedPurgeKey(url: string, userId: string): string | null {
  const configured = ownedMediaStorageKeyForUrl({ url, userId });
  if (configured) return configured;
  // Published aliases of this application's bucket; arbitrary same-path hosts never authorize deletion.
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['assets.maxvideo.ai','cdn.maxvideoai.com','media.maxvideoai.com'].includes(parsed.hostname)
      || (parsed.port && parsed.port !== '443') || parsed.username || parsed.password) return null;
  const key = parsed.pathname.slice(1);
  return isOwnedMediaStorageKey({key,userId}) ? key : null;
}
async function hasActiveWork(userId: string, tables: WorkTable[], tx: TransactionQueryExecutor) {
  if (!tables.length) return false;
  return (await tx.query(`SELECT 1 FROM (${tables.map(table => `(SELECT 1 FROM ${table} work WHERE user_id=$1 AND ${workPredicates[table]} LIMIT 1)`).join(' UNION ALL ')}) active_work LIMIT 1`, [userId])).length > 0;
}
async function hasLiveFile(key: string, projectionRetentionSql: string, tx: TransactionQueryExecutor) {
  // A possible alias only retains bytes. Authority to delete was separately proved at enqueue.
  return (await tx.query(`SELECT 1 FROM media_assets WHERE deleted_at IS NULL AND status<>'deleted' AND
      $1=ANY(ARRAY[library_possible_storage_key(url),library_possible_storage_key(thumb_url),library_possible_storage_key(preview_url),library_possible_storage_key(metadata#>>'{imageDisplay,url}')])
    UNION ALL SELECT 1 FROM user_assets WHERE
      $1=ANY(ARRAY[library_possible_storage_key(url),library_possible_storage_key(metadata->>'thumbUrl'),library_possible_storage_key(metadata->>'previewUrl'),library_possible_storage_key(metadata#>>'{imageDisplay,url}')])
    UNION ALL SELECT 1 FROM job_outputs WHERE status<>'deleted' AND
      $1=ANY(ARRAY[library_possible_storage_key(url),library_possible_storage_key(storage_url),library_possible_storage_key(thumb_url),library_possible_storage_key(preview_url),library_possible_storage_key(metadata#>>'{imageDisplay,url}')]) UNION ALL ${projectionRetentionSql} LIMIT 1`, [key])).length > 0;
}
function sourceProof(sources: OrganizationSource[]): string {
  return JSON.stringify(sources.map(source => [source.type,source.id,source.publicId,source.kind,source.url,source.original,
    source.provenance,source.jobId,source.outputId,source.available,source.canonicalId??null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
async function enqueueObjects(request: RequestRow, files: PurgeSourceFile[], ownedKey: (url:string,userId:string)=>string|null, tx: TransactionQueryExecutor) {
  const objects = new Map<string, {url:string; role:PurgeSourceFile['role']; sizes:Set<number>}>();
  for (const file of files) {
    const key = ownedKey(file.url, request.user_id);
    if (!key) continue; // Foreign/provider objects never become deletion targets.
    const previous = objects.get(key);
    const object = previous ?? {url:file.url,role:file.role,sizes:new Set<number>()};
    if (file.role === 'original') object.role = 'original';
    if (file.sizeBytes !== null) object.sizes.add(file.sizeBytes);
    objects.set(key, object);
  }
  if (!objects.size) return;
  const rows = [...objects].map(([key,object])=>({key,url:object.url,role:object.role,
    size:object.sizes.size===1?[...object.sizes][0]:null,conflict:object.sizes.size>1}));
  await tx.query(`INSERT INTO library_purge_objects(user_id,organization_key,object_key,url,size_bytes,size_conflict,role)
    SELECT $1,$2,key,url,size,conflict,role FROM jsonb_to_recordset($3::jsonb) AS f(key text,url text,size bigint,conflict boolean,role text)
    ON CONFLICT(user_id,organization_key,object_key) DO NOTHING`, [request.user_id,request.organization_key,JSON.stringify(rows)]);
}

export async function processLibraryPurgeBatch(input: {userId?:string;limit?:number;now?:Date} = {}, dependencies: {
  deleteStorageObjectKey?:(key:string)=>Promise<unknown>; ownedKey?:(url:string,userId:string)=>string|null;
} = {}) {
  if(!dependencies.deleteStorageObjectKey && process.env.VERCEL_ENV!=='production') throw new Error('PURGE_RUNTIME_NOT_PRODUCTION');
  const limit = input.limit ?? 20, now = input.now ?? new Date(), deadline = Date.now()+40_000;
  if (!Number.isInteger(limit) || limit<1 || limit>100) throw new Error('INVALID_PURGE_LIMIT');
  const remove = dependencies.deleteStorageObjectKey ?? ((key:string)=>deleteStorageObjectKey(key,{abortSignal:AbortSignal.timeout(10_000)}));
  const ownedKey = dependencies.ownedKey ?? ownedPurgeKey;
  const tables = (await query<{name:WorkTable}>('SELECT name FROM unnest($1::text[]) AS names(name) WHERE to_regclass(name) IS NOT NULL',[Object.keys(workPredicates)])).map(row=>row.name);
  const projectionRetentionSql=await readPurgeProjectionRetentionSql({query});
  const requests = await query<RequestRow>(`SELECT * FROM library_purge_requests WHERE state IN ('pending','deleting')
    AND not_before<=$1 AND ($2::text IS NULL OR user_id=$2) ORDER BY not_before,requested_at,user_id,organization_key LIMIT $3`,[now,input.userId??null,limit]);
  let completedCount=0, pendingCount=0;
  for (const request of requests) {
    if (Date.now()>=deadline) {pendingCount++;continue;}
    try {
      const proceed = await withDbTransaction(async tx=>{
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,97))',[request.user_id]);
        const [current] = await tx.query<RequestRow>('SELECT * FROM library_purge_requests WHERE user_id=$1 AND organization_key=$2 FOR UPDATE',[request.user_id,request.organization_key]);
        if (!current || !['pending','deleting'].includes(current.state) || new Date(current.not_before)>now) return false;
        // Claim eligibility before work. Active users and failures yield the next cron batch to other accounts.
        await tx.query('UPDATE library_purge_requests SET not_before=$3 WHERE user_id=$1 AND organization_key=$2', [request.user_id,request.organization_key,new Date(now.getTime()+120_000)]);
        if (current.state==='deleting') {
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,98))',[request.user_id]);
          return !await hasActiveWork(request.user_id,tables,tx);
        }
        const [resolved] = await resolveOrganizationBatch(request.user_id,[{...request.reference,sourceRevision:request.source_revision}],tx,{allowPurging:true,lockSources:false});
        if (resolved.error || resolved.key!==request.organization_key || resolved.sourceRevision!==request.source_revision || !resolved.state?.trashedAt || !resolved.identity
          || sourceProof(current.sources)!==sourceProof(resolved.identity.sources)) {
          await tx.query("UPDATE library_purge_requests SET state='failed',last_error='SOURCE_CHANGED' WHERE user_id=$1 AND organization_key=$2",[request.user_id,request.organization_key]);
          await tx.query('UPDATE library_organization SET purge_requested_at=NULL WHERE user_id=$1 AND key=$2',[request.user_id,request.organization_key]);
          return false;
        }
        const plan=await readPurgeSourcePlan(request.user_id,resolved.identity.sources,tx);
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,98))',[request.user_id]);
        if (await hasActiveWork(request.user_id,tables,tx)) return false;
        await tx.query('UPDATE library_purge_requests SET source_plan=$3::jsonb WHERE user_id=$1 AND organization_key=$2',[request.user_id,request.organization_key,JSON.stringify(plan)]);
        const hashes=purgeTokenHashes([...purgeSourceTokens(plan.sources),...plan.files.map(file=>file.url)]);
        await tx.query('INSERT INTO library_purge_tokens(user_id,organization_key,token_hash) SELECT $1,$2,hash FROM unnest($3::text[]) hashes(hash) ON CONFLICT DO NOTHING',[request.user_id,request.organization_key,hashes]);
        const files = await applyPurgeSourcePlan(request.user_id,plan,tx);
        await enqueueObjects(request,files,ownedKey,tx);
        await tx.query("UPDATE library_purge_requests SET state='deleting',last_error=NULL WHERE user_id=$1 AND organization_key=$2",[request.user_id,request.organization_key]);
        return true;
      });
      if (!proceed) {pendingCount++;continue;}
      const objects = await query<{object_key:string}>(`SELECT object_key FROM library_purge_objects WHERE user_id=$1 AND organization_key=$2
        AND (state IN ('pending','shared') OR (state='deleting' AND lease_expires_at<=$3)) ORDER BY (state='shared'),attempts,object_key LIMIT 10`,[request.user_id,request.organization_key,now]);
      for (const object of objects) {
        if (Date.now()>=deadline) break;
        const lease = randomUUID(), fenceTable = purgeFenceTable(object.object_key);
        const claimed = await withDbTransaction(async tx=>{
          const [currentObject] = await tx.query<{state:string;lease_expires_at:Date|null}>('SELECT state,lease_expires_at FROM library_purge_objects WHERE user_id=$1 AND organization_key=$2 AND object_key=$3 FOR UPDATE',[request.user_id,request.organization_key,object.object_key]);
          if (!currentObject || !['pending','shared','deleting'].includes(currentObject.state)
            || (currentObject.state==='deleting' && currentObject.lease_expires_at && new Date(currentObject.lease_expires_at)>now)) return false;
          // Persistence and existing content-addressed producers acquire this same physical-object fence.
          const [fence] = await tx.query<{state:string;producer_lease_expires_at:Date|null;delete_lease_expires_at:Date|null}>(`INSERT INTO ${fenceTable}(object_key,state,created_at,updated_at)
            VALUES($1,'available',clock_timestamp(),clock_timestamp()) ON CONFLICT(object_key) DO UPDATE SET updated_at=${fenceTable}.updated_at
            RETURNING state,producer_lease_expires_at,delete_lease_expires_at`,[object.object_key]);
          if ((fence.producer_lease_expires_at&&new Date(fence.producer_lease_expires_at)>now)
            || (fence.state==='deleting'&&fence.delete_lease_expires_at&&new Date(fence.delete_lease_expires_at)>now)) return false;
          if (await hasLiveFile(object.object_key,projectionRetentionSql,tx)) {
            await tx.query("UPDATE library_purge_objects SET state='shared',reason='LIVE_REFERENCE' WHERE user_id=$1 AND organization_key=$2 AND object_key=$3",[request.user_id,request.organization_key,object.object_key]);
            return false;
          }
          const claimed = await tx.query(`UPDATE library_purge_objects SET state='deleting',lease_id=$4,lease_expires_at=$5,attempts=attempts+1
            WHERE user_id=$1 AND organization_key=$2 AND object_key=$3 AND (state IN ('pending','shared') OR (state='deleting' AND lease_expires_at<=$6)) RETURNING object_key`,[request.user_id,request.organization_key,object.object_key,lease,new Date(now.getTime()+300_000),now]);
          if (!claimed.length) return false;
          await tx.query(`UPDATE ${fenceTable} SET state='deleting',producer_claim_id=NULL,producer_lease_expires_at=NULL,
            delete_claim_id=$2,delete_lease_expires_at=$3,updated_at=clock_timestamp() WHERE object_key=$1`,[object.object_key,lease,new Date(now.getTime()+300_000)]);
          return true;
        });
        if (!claimed) continue;
        try {
          await remove(object.object_key);
          await withDbTransaction(async tx=>{
            const settled = await tx.query(`UPDATE ${fenceTable} SET state='deleted',delete_claim_id=NULL,delete_lease_expires_at=NULL,updated_at=clock_timestamp() WHERE object_key=$1 AND state='deleting' AND delete_claim_id=$2 RETURNING object_key`,[object.object_key,lease]);
            if (settled.length) await tx.query("UPDATE library_purge_objects SET state='deleted',lease_id=NULL,lease_expires_at=NULL,reason=NULL WHERE user_id=$1 AND organization_key=$2 AND object_key=$3 AND lease_id=$4",[request.user_id,request.organization_key,object.object_key,lease]);
          });
        } catch {
          await query("UPDATE library_purge_objects SET state='pending',lease_id=NULL,lease_expires_at=NULL,reason='STORAGE_RETRY' WHERE user_id=$1 AND organization_key=$2 AND object_key=$3 AND lease_id=$4",[request.user_id,request.organization_key,object.object_key,lease]);
          // Never reopen producer access after an uncertain S3 result. Retry the idempotent delete first.
          await query(`UPDATE ${fenceTable} SET delete_lease_expires_at=$3 WHERE object_key=$1 AND state='deleting' AND delete_claim_id=$2`,[object.object_key,lease,now]);
        }
      }
      const done = await query(`UPDATE library_purge_requests r SET state='completed',completed_at=clock_timestamp() WHERE user_id=$1 AND organization_key=$2 AND state='deleting'
        AND NOT EXISTS(SELECT 1 FROM library_purge_objects o WHERE o.user_id=r.user_id AND o.organization_key=r.organization_key AND o.state IN ('pending','deleting','shared')) RETURNING organization_key`,[request.user_id,request.organization_key]);
      if (done.length) completedCount++; else pendingCount++;
    } catch (error) {
      pendingCount++;
      if(error instanceof Error && /^PURGE_(SOURCE|PREPARATION)/.test(error.message)){
        await withDbTransaction(async tx=>{
          const failed=await tx.query("UPDATE library_purge_requests SET state='failed',last_error='SOURCE_CHANGED' WHERE user_id=$1 AND organization_key=$2 AND state='pending' RETURNING organization_key",[request.user_id,request.organization_key]);
          if(failed.length)await tx.query('UPDATE library_organization SET purge_requested_at=NULL WHERE user_id=$1 AND key=$2',[request.user_id,request.organization_key]);
        });
        continue;
      }
      await query("UPDATE library_purge_requests SET last_error='CLEANUP_RETRY',not_before=$3 WHERE user_id=$1 AND organization_key=$2 AND state<>'completed'",[request.user_id,request.organization_key,new Date(now.getTime()+120_000)]);
    }
  }
  return {selectedCount:requests.length,completedCount,pendingCount};
}
