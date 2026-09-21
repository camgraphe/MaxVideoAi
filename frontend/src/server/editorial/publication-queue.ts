import {query,withDbTransaction,type TransactionQueryExecutor} from '@/lib/db';
import {parseEditorialDraft} from '@/lib/editorial/schema';
import {validateEditorialCheckReport} from '@/lib/editorial/checks';
import type {EditorialVersionRef} from './repository';
export type PublicationStatus='queued'|'processing'|'awaiting-ci'|'awaiting-deployment'|'published'|'blocked'|'cancelled';
export type PublicationReceipt={branch?:string;commit?:string;pullRequest?:number;pullRequestUrl?:string;mergeCommit?:string;deploymentStartedAt?:string;failures?:number;ciPolls?:number;urls?:string[]};
export type EditorialPublication=EditorialVersionRef & {status:PublicationStatus;requestedAt:string;publishedAt:string|null;receipt:PublicationReceipt;error:string|null};
type Row={article_id:string;version:number;digest:string;status:PublicationStatus;requested_at:string;published_at:string|null;receipt:PublicationReceipt;error:string|null};
function map(r:Row):EditorialPublication{return {articleId:r.article_id,version:r.version,digest:r.digest.trim(),status:r.status,requestedAt:new Date(r.requested_at).toISOString(),publishedAt:r.published_at?new Date(r.published_at).toISOString():null,receipt:r.receipt,error:r.error};}
export async function getEditorialPublication(articleId:string,version:number){const rows=await query<Row>('SELECT * FROM editorial_publications WHERE article_id=$1 AND version=$2',[articleId,version]);return rows[0]?map(rows[0]):null;}

// Caller holds the article row lock. Never edit under an irreversible remote operation.
export async function guardEditorialPublicationEdit(tx:TransactionQueryExecutor,articleId:string){
 const active=await tx.query("SELECT version FROM editorial_publications WHERE article_id=$1 AND status IN ('processing','awaiting-ci','awaiting-deployment','blocked') LIMIT 1",[articleId]);
 if(active.length)throw Error('Publication in progress; resolve its status before changing this article');
 await tx.query("UPDATE editorial_publications SET status='cancelled',updated_at=now() WHERE article_id=$1 AND status='queued'",[articleId]);
}
async function validateTarget(tx:TransactionQueryExecutor,input:EditorialVersionRef){
 const article=await tx.query('SELECT id FROM editorial_articles WHERE id=$1 FOR UPDATE',[input.articleId]);
 if(!article.length)throw Error('Editorial article not found');
 const latest=(await tx.query<{version:number;digest:string;payload:unknown;approved_at:string|null}>(
  'SELECT version,digest,payload,approved_at FROM editorial_versions WHERE article_id=$1 ORDER BY version DESC LIMIT 1',[input.articleId]))[0];
 if(!latest||latest.version!==input.version||latest.digest.trim()!==input.digest)throw Error('Publication target is not the latest exact version');
 const corrections=await tx.query("SELECT id FROM editorial_events WHERE article_id=$1 AND version=$2 AND kind='draft_rejected' LIMIT 1",[input.articleId,input.version]);
 if(corrections.length)throw Error('A correction requires a new version before publication');
 const checks=(await tx.query<{report:unknown}>('SELECT report FROM editorial_checks WHERE article_id=$1 AND version=$2',[input.articleId,input.version]))[0];
 if(!checks)throw Error('Publication checks required');
 validateEditorialCheckReport(parseEditorialDraft(latest.payload),input.digest,checks.report);
 return latest;
}
export async function requestEditorialPublication(input:EditorialVersionRef & {actor:string}):Promise<EditorialPublication>{
 return withDbTransaction(async tx=>{
  const latest=await validateTarget(tx,input);
  const previous=(await tx.query<Row>('SELECT * FROM editorial_publications WHERE article_id=$1 AND version=$2',[input.articleId,input.version]))[0];
  if(previous){if(previous.digest.trim()!==input.digest||previous.status==='cancelled')throw Error('Publication request is no longer valid');return map(previous);}
  if(!latest.approved_at){
   await tx.query('UPDATE editorial_versions SET approved_by=$1,approved_at=now() WHERE article_id=$2 AND version=$3',[input.actor,input.articleId,input.version]);
   await tx.query("UPDATE editorial_articles SET status='approved' WHERE id=$1",[input.articleId]);
   await tx.query("INSERT INTO editorial_events(article_id,version,kind,actor,detail) VALUES($1,$2,'draft_approved',$3,$4::jsonb)",[input.articleId,input.version,input.actor,JSON.stringify({digest:input.digest,intent:'publish'})]);
  }
  const row=(await tx.query<Row>("INSERT INTO editorial_publications(article_id,version,digest,status,requested_by) VALUES($1,$2,$3,'queued',$4) RETURNING *",[input.articleId,input.version,input.digest,input.actor]))[0];
  return map(row);
 });
}
export async function beginEditorialPublication(articleId:string,version:number){
 return withDbTransaction(async tx=>{
  await tx.query('SELECT id FROM editorial_articles WHERE id=$1 FOR UPDATE',[articleId]);
  const row=(await tx.query<Row>('SELECT * FROM editorial_publications WHERE article_id=$1 AND version=$2 FOR UPDATE',[articleId,version]))[0];
  if(!row||row.status!=='queued')throw Error('Publication is not queued');
  const latest=await validateTarget(tx,{articleId,version,digest:row.digest.trim()});
  if(!latest.approved_at)throw Error('Human approval required');
  return map((await tx.query<Row>("UPDATE editorial_publications SET status='processing',updated_at=now() WHERE article_id=$1 AND version=$2 RETURNING *",[articleId,version]))[0]);
 });
}
// Used only by the local server worker; not exposed to the ingestion API.
export async function savePublicationProgress(ref:EditorialVersionRef,status:PublicationStatus,receipt:PublicationReceipt,error:string|null=null){
 const rows=await query<Row>(`UPDATE editorial_publications SET status=$4,receipt=$5::jsonb,error=$6,updated_at=now(),published_at=CASE WHEN $4='published' THEN COALESCE(published_at,now()) ELSE published_at END
 WHERE article_id=$1 AND version=$2 AND digest=$3 AND status NOT IN ('cancelled','published') RETURNING *`,[ref.articleId,ref.version,ref.digest,status,JSON.stringify(receipt),error]);
 if(!rows[0])throw Error('Publication state changed');return map(rows[0]);
}

export async function pendingPublicationNotifications(){
 const ready=await query<{articleId:string;version:number;digest:string;title:string}>(`SELECT v.article_id AS "articleId",v.version,trim(v.digest) AS digest,v.payload->'locales'->'en'->>'title' AS title
 FROM editorial_checks c JOIN editorial_versions v USING(article_id,version)
 WHERE c.notified_at IS NULL AND v.version=(SELECT max(v2.version) FROM editorial_versions v2 WHERE v2.article_id=v.article_id)
 AND NOT EXISTS(SELECT 1 FROM editorial_events e WHERE e.article_id=v.article_id AND e.version=v.version AND e.kind='draft_rejected')
 AND NOT EXISTS(SELECT 1 FROM editorial_publications p WHERE p.article_id=v.article_id AND p.version=v.version)
 ORDER BY c.created_at LIMIT 20`);
 const terminal=await query<{articleId:string;version:number;digest:string;title:string;status:string;urls:string[];message:string|null}>(`SELECT p.article_id AS "articleId",p.version,trim(p.digest) AS digest,v.payload->'locales'->'en'->>'title' AS title,p.status,p.receipt->'urls' AS urls,p.error AS message
 FROM editorial_publications p JOIN editorial_versions v USING(article_id,version) WHERE p.status IN ('published','blocked') AND p.notified_at IS NULL ORDER BY p.updated_at LIMIT 20`);
 const held=await query<{articleId:string;version:number;digest:string;title:string}>(`SELECT v.article_id AS "articleId",v.version,trim(v.digest) AS digest,v.payload->'locales'->'en'->>'title' AS title
 FROM editorial_versions v WHERE v.qa_notified_at IS NULL AND v.version=(SELECT max(n.version) FROM editorial_versions n WHERE n.article_id=v.article_id)
 AND NOT EXISTS(SELECT 1 FROM editorial_checks c WHERE c.article_id=v.article_id AND c.version=v.version)
 AND (SELECT count(*) FROM editorial_events e WHERE e.article_id=v.article_id AND e.version=v.version AND e.actor='publication-qa' AND e.id>COALESCE((SELECT max(r.id) FROM editorial_events r WHERE r.article_id=v.article_id AND r.version=v.version AND r.actor='publication-qa-reset'),0))>=3 LIMIT 20`);
 return [...held.map(r=>({...r,status:'qa-held',message:'Les contrôles automatiques se sont arrêtés après trois essais. Le motif et le bouton de relance sont disponibles dans l’admin.'})),...ready.map(r=>({...r,status:'ready-for-approval',previewUrl:`https://maxvideoai.com/admin/editorial/${r.articleId}?version=${r.version}`})),...terminal];
}
export async function acknowledgePublicationNotification(ref:EditorialVersionRef,status:string){
 if(status==='qa-held')await query('UPDATE editorial_versions SET qa_notified_at=now() WHERE article_id=$1 AND version=$2 AND digest=$3',[ref.articleId,ref.version,ref.digest]);
 else if(status==='ready-for-approval')await query('UPDATE editorial_checks SET notified_at=now() WHERE article_id=$1 AND version=$2 AND digest=$3',[ref.articleId,ref.version,ref.digest]);
 else if(['published','blocked'].includes(status))await query('UPDATE editorial_publications SET notified_at=now() WHERE article_id=$1 AND version=$2 AND digest=$3 AND status=$4',[ref.articleId,ref.version,ref.digest,status]);
}

export async function retryEditorialPublication(input:EditorialVersionRef & {actor:string}){
 return withDbTransaction(async tx=>{
  await validateTarget(tx,input);
  const row=(await tx.query<Row>('SELECT * FROM editorial_publications WHERE article_id=$1 AND version=$2 FOR UPDATE',[input.articleId,input.version]))[0];
  if(!row||row.status!=='blocked')throw Error('Publication is not blocked');
  const receipt={...row.receipt,failures:0,ciPolls:0};
  const status=receipt.mergeCommit?'awaiting-deployment':receipt.commit?'processing':'queued';
  const next=(await tx.query<Row>('UPDATE editorial_publications SET status=$3,receipt=$4::jsonb,error=NULL,notified_at=NULL,updated_at=now() WHERE article_id=$1 AND version=$2 RETURNING *',[input.articleId,input.version,status,JSON.stringify(receipt)]))[0];
  return map(next);
 });
}
