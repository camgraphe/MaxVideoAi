import { purgeSourceTokens, purgeTokenHashes } from './purge-tokens';
import { withDbTransaction } from '@/lib/db';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { discoverPreparedPurgeSources } from './purge-prepared-sources';
import { organizationSourceGroups } from './organization-identity';
import { referenceIdentity, sourceReference, sourceIdentity } from './organization-sources';
import { resolveOrganizationBatch } from './organization-resolver';
import { LibraryOrganizationError, onlyFields, requireLibraryOwner } from './organization-validation';

export async function requestLibraryTrashPurge(input: {userId:string;snapshotId:string;confirmation:string}) {
  onlyFields(input,['userId','snapshotId','confirmation']); requireLibraryOwner(input.userId);
  const {userId,snapshotId}=input;
  if(input.confirmation!=='empty-trash') throw new LibraryOrganizationError('CONFIRMATION_REQUIRED');
  if(typeof snapshotId!=='string'||!/^ls_[a-f0-9-]{36}$/.test(snapshotId)) throw new LibraryOrganizationError('INVALID_SNAPSHOT');
  return withDbTransaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,97))',[userId]);
    const [snapshot]=await tx.query<{scope:LibraryBrowseScope;total_count:number;expired:boolean}>('SELECT scope,total_count,expires_at<=clock_timestamp() AS expired FROM library_selection_snapshots WHERE user_id=$1 AND id=$2 FOR SHARE',[userId,snapshotId]);
    if(!snapshot) throw new LibraryOrganizationError('SNAPSHOT_NOT_FOUND',404);
    if(snapshot.expired) throw new LibraryOrganizationError('SNAPSHOT_EXPIRED',409);
    const scope=snapshot.scope;
    if(scope.trash!==true||scope.kind!=='all'||scope.view!=='all'||scope.q||scope.favorite||scope.collectionId||scope.source||scope.surface||scope.jobId) throw new LibraryOrganizationError('TRASH_SCOPE_REQUIRED',409);
    const items=await tx.query<{organization_key:string;reference:LibraryMediaReference;source_revision:string}>('SELECT organization_key,reference,source_revision FROM library_selection_snapshot_items WHERE user_id=$1 AND snapshot_id=$2 ORDER BY ordinal',[userId,snapshotId]);
    if(items.length!==snapshot.total_count||items.length>10000)throw new LibraryOrganizationError('INVALID_SNAPSHOT',409);
    const existing=new Set((await tx.query<{organization_key:string}>('SELECT organization_key FROM library_purge_requests WHERE user_id=$1 AND organization_key=ANY($2::text[]) AND state<>\'failed\'',[userId,items.map(x=>x.organization_key)])).map(x=>x.organization_key));
    const fresh=items.filter(x=>!existing.has(x.organization_key));
    const resolved=await resolveOrganizationBatch(userId,fresh.map(x=>({...x.reference,sourceRevision:x.source_revision})),tx);
    if(resolved.some((row,i)=>row.error||!row.identity||row.key!==fresh[i].organization_key||row.sourceRevision!==fresh[i].source_revision||!row.state?.trashedAt)) throw new LibraryOrganizationError('TRASH_CHANGED',409);
    // Lock originals before admission; preparation persistence shares this account fence.
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,98))',[userId]);
    // Discover technical descendants once for the whole frozen selection. No per-item planning or S3 reads.
    const descendants=await discoverPreparedPurgeSources(userId,resolved.flatMap(row=>row.identity!.sources),tx);
    const rootByReference=new Map(resolved.flatMap(row=>row.identity!.sources.map(source=>[referenceIdentity(sourceReference(source)),row.key!] as const)));
    for(let depth=0;depth<8;depth++)for(const edge of descendants.prepared){
      const root=rootByReference.get(referenceIdentity(edge.source));
      if(root)rootByReference.set(referenceIdentity(edge.reference),root);
    }
    const groups=organizationSourceGroups(descendants.sources);
    for(const group of new Set(groups.values())){
      const roots=new Set(group.map(source=>rootByReference.get(referenceIdentity(sourceReference(source)))).filter((root):root is string=>Boolean(root)));
      if(roots.size>1)throw new LibraryOrganizationError('TRASH_CHANGED',409);
      const root=[...roots][0];
      if(root)for(const source of group)rootByReference.set(referenceIdentity(sourceReference(source)),root);
    }
    const sourcesByRoot=new Map(resolved.map(row=>[row.key!,new Map(row.identity!.sources.map(source=>[sourceIdentity(source),source]))]));
    for(const source of descendants.sources){
      const root=rootByReference.get(referenceIdentity(sourceReference(source)));
      if(root)sourcesByRoot.get(root)?.set(sourceIdentity(source),source);
    }
    const records=resolved.map(row=>({key:row.key!,kind:row.identity!.kind,reference:row.reference,revision:row.sourceRevision,sources:row.identity!.sources,admissionSources:[...(sourcesByRoot.get(row.key!)?.values()??[])]}));
    if(records.length){
      await tx.query(`INSERT INTO library_purge_requests(user_id,organization_key,kind,reference,source_revision,sources,admission_sources)
        SELECT $1,key,kind,reference,revision,sources,"admissionSources" FROM jsonb_to_recordset($2::jsonb) AS r(key text,kind text,reference jsonb,revision text,sources jsonb,"admissionSources" jsonb)
        ON CONFLICT(user_id,organization_key) DO UPDATE
        SET state='pending',reference=EXCLUDED.reference,source_revision=EXCLUDED.source_revision,sources=EXCLUDED.sources,admission_sources=EXCLUDED.admission_sources,
          requested_at=clock_timestamp(),not_before=clock_timestamp()+interval '10 minutes',last_error=NULL
        WHERE library_purge_requests.state='failed'`,[userId,JSON.stringify(records)]);
      const tokens=records.flatMap(record=>purgeTokenHashes(purgeSourceTokens(sourcesByRoot.get(record.key)?.values()??record.sources)).map(hash=>({key:record.key,hash})));
      await tx.query(`INSERT INTO library_purge_tokens(user_id,organization_key,token_hash)
        SELECT $1,key,hash FROM jsonb_to_recordset($2::jsonb) AS t(key text,hash text) ON CONFLICT DO NOTHING`,[userId,JSON.stringify(tokens)]);
      await tx.query('UPDATE library_organization SET purge_requested_at=clock_timestamp(),updated_at=clock_timestamp() WHERE user_id=$1 AND key=ANY($2::text[])',[userId,records.map(row=>row.key)]);
    }
    return {requestedCount:items.length,queuedCount:fresh.length,alreadyQueuedCount:existing.size};
  });
}
