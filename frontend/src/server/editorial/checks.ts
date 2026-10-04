import {query,withDbTransaction} from '@/lib/db';
import {parseEditorialDraft} from '@/lib/editorial/schema';
import {validateEditorialCheckReport} from '@/lib/editorial/checks';
import {EDITORIAL_RENDER_VERSION} from '@/lib/editorial/public-article';
export async function saveEditorialChecks(articleId:string,version:number,digest:string,input:unknown,actor:string){
 return withDbTransaction(async tx=>{
  await tx.query('SELECT id FROM editorial_articles WHERE id=$1 FOR UPDATE',[articleId]);
  const latest=(await tx.query<{version:number;digest:string;payload:unknown}>('SELECT version,digest,payload FROM editorial_versions WHERE article_id=$1 ORDER BY version DESC LIMIT 1',[articleId]))[0];
  if(!latest||latest.version!==version||latest.digest.trim()!==digest)throw Error('Checks target is not the latest exact version');
  const report=validateEditorialCheckReport(parseEditorialDraft(latest.payload),digest,input);
  await tx.query(`INSERT INTO editorial_checks(article_id,version,digest,renderer_version,report,actor) VALUES($1,$2,$3,$4,$5::jsonb,$6)
   ON CONFLICT(article_id,version) DO UPDATE SET report=EXCLUDED.report,renderer_version=EXCLUDED.renderer_version,actor=EXCLUDED.actor,created_at=now() WHERE editorial_checks.digest=EXCLUDED.digest`,[articleId,version,digest,EDITORIAL_RENDER_VERSION,JSON.stringify(report),actor]);
  return {status:'checked' as const,digest,version};
 });
}
export async function getEditorialChecks(articleId:string,version:number){
 const rows=await query<{digest:string;renderer_version:string;report:unknown}>('SELECT digest,renderer_version,report FROM editorial_checks WHERE article_id=$1 AND version=$2',[articleId,version]);return rows[0]??null;
}

export async function getEditorialQaIssue(articleId:string,version:number){
 const rows=await query<{attempts:number;message:string|null}>(`SELECT count(*)::int AS attempts,(array_agg(detail->>'message' ORDER BY id DESC))[1] AS message FROM editorial_events
 WHERE article_id=$1 AND version=$2 AND kind='draft_error' AND actor='publication-qa'
 AND id>COALESCE((SELECT max(id) FROM editorial_events WHERE article_id=$1 AND version=$2 AND actor='publication-qa-reset'),0)`,[articleId,version]);
 return rows[0]??{attempts:0,message:null};
}
export async function retryEditorialChecks(articleId:string,version:number,digest:string,actor:string){
 return withDbTransaction(async tx=>{
  await tx.query('SELECT id FROM editorial_articles WHERE id=$1 FOR UPDATE',[articleId]);
  const latest=(await tx.query<{version:number;digest:string}>('SELECT version,digest FROM editorial_versions WHERE article_id=$1 ORDER BY version DESC LIMIT 1',[articleId]))[0];
  if(!latest||latest.version!==version||latest.digest.trim()!==digest)throw Error('Checks target is not the latest exact version');
  await tx.query('UPDATE editorial_versions SET qa_notified_at=NULL WHERE article_id=$1 AND version=$2',[articleId,version]);
  await tx.query("INSERT INTO editorial_events(article_id,version,kind,actor,detail) VALUES($1,$2,'draft_error','publication-qa-reset',$3::jsonb)",[articleId,version,JSON.stringify({requestedBy:actor})]);
 });
}
