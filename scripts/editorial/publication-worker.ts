import {assertPublicationAllowed} from './publication-control';
// Local server process. n8n supplies no database/storage/Git credentials.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {getDb,query} from '../../frontend/src/lib/db';
import {getEditorialVersion,type EditorialVersionRef} from '../../frontend/src/server/editorial/repository';
import {getEditorialChecks,saveEditorialChecks,getEditorialQaIssue} from '../../frontend/src/server/editorial/checks';
import {beginEditorialPublication,getEditorialPublication,savePublicationProgress,pendingPublicationNotifications,acknowledgePublicationNotification} from '../../frontend/src/server/editorial/publication-queue';
import {preparePublicationBranch} from '../../frontend/src/server/editorial/publication-git';
import {buildEditorialPublicationFiles} from '../../frontend/src/server/editorial/publication-content';
import {publicationCiState} from '../../frontend/src/server/editorial/publication-ci';
async function main(){
 if(process.env.EDITORIAL_WORKER_ENABLED!=='1')throw Error('Publication worker is disabled');
 const envPath=process.env.EDITORIAL_WORKER_ENV;if(!envPath)throw Error('Worker environment path required');
 const require=createRequire(path.resolve('frontend/package.json')),values=require('dotenv').parse(readFileSync(envPath));
 for(const [key,value] of Object.entries(values))process.env[key]=String(value).trim();
 if(process.argv[2]==='--ack'){const ref=JSON.parse(process.argv[3]);await acknowledgePublicationNotification(ref,ref.status);return;}
 const emit=async(result:Record<string,unknown>)=>console.log(JSON.stringify({...result,events:await pendingPublicationNotifications()}));
 const allowed=()=>assertPublicationAllowed(process.env.EDITORIAL_WORKER_CONTROL_ROOT);
 allowed();
 const {githubApi,promoteMedia}=await import('./publication-runtime');
 const {checkEditorialCandidate,inspectArticleViews,articleUrls}=await import('./publication-qa');
 const repository=process.env.EDITORIAL_GITHUB_REPOSITORY??'camgraphe/MaxVideoAi',rawApi=githubApi(repository);
 const api=async(method:string,url:string,body?:unknown)=>{if(method!=='GET')allowed();return rawApi(method,url,body);};
 // A database session lock survives neither crash nor shutdown; no stale file lock.
 const lock=await getDb().connect();
 try{
  if(!(await lock.query("SELECT pg_try_advisory_lock(hashtext('editorial-publication-worker')) AS acquired")).rows[0].acquired)return console.log(JSON.stringify({status:'busy'}));
  const queued=await query<{article_id:string;version:number}>("SELECT article_id,version FROM editorial_publications WHERE status IN ('queued','processing','awaiting-ci','awaiting-deployment') ORDER BY requested_at LIMIT 1");
  if(!queued.length){
   const candidate=(await query<{article_id:string;version:number}>(`SELECT v.article_id,v.version FROM editorial_versions v
    WHERE v.version=(SELECT max(v2.version) FROM editorial_versions v2 WHERE v2.article_id=v.article_id)
    AND NOT EXISTS(SELECT 1 FROM editorial_checks c WHERE c.article_id=v.article_id AND c.version=v.version)
    AND NOT EXISTS(SELECT 1 FROM editorial_events e WHERE e.article_id=v.article_id AND e.version=v.version AND e.kind='draft_rejected')
    AND (SELECT count(*) FROM editorial_events e WHERE e.article_id=v.article_id AND e.version=v.version AND e.kind='draft_error' AND e.actor='publication-qa' AND e.id>COALESCE((SELECT max(reset.id) FROM editorial_events reset WHERE reset.article_id=v.article_id AND reset.version=v.version AND reset.actor='publication-qa-reset'),0))<3
    ORDER BY v.created_at LIMIT 1`))[0];
   if(!candidate)return await emit({status:'idle'});
   const record=await getEditorialVersion(candidate.article_id,candidate.version);if(!record)throw Error('Draft unavailable');
   try{const report=await checkEditorialCandidate(record,process.cwd());await saveEditorialChecks(record.articleId,record.version,record.digest,report,'publication-worker');await emit({status:'checked',articleId:record.articleId,version:record.version});}
   catch(e){await query("INSERT INTO editorial_events(article_id,version,kind,actor,detail) VALUES($1,$2,'draft_error','publication-qa',$3::jsonb)",[record.articleId,record.version,JSON.stringify({message:String((e as Error).message).slice(0,1000)})]);await emit({status:(await getEditorialQaIssue(record.articleId,record.version)).attempts>=3?'qa-held':'qa-retrying',articleId:record.articleId,version:record.version});}
   return;
  }
  let job=(await getEditorialPublication(queued[0].article_id,queued[0].version))!;
  const record=await getEditorialVersion(job.articleId,job.version);if(!record||record.digest!==job.digest)throw Error('Publication identity mismatch');
  const ref:EditorialVersionRef=job;
  try{
   if(job.status==='queued')job=await beginEditorialPublication(job.articleId,job.version);
   if(job.status==='processing'){
    const media=await promoteMedia(record,allowed),checks=await getEditorialChecks(job.articleId,job.version);
    const bundle=buildEditorialPublicationFiles(record,media,checks?.report);
    const branch=`codex/editorial-${record.articleId}-v${record.version}`;
    const receipt=await preparePublicationBranch({api,branch,files:bundle.files,message:`Publish editorial ${record.articleId} v${record.version}\n\nDigest: ${record.digest}`,receipt:job.receipt,checkpoint:async receipt=>{job=await savePublicationProgress(ref,'processing',receipt);}});
    job=await savePublicationProgress(ref,'processing',receipt);
    const matches=await api('GET',`pulls?state=all&head=${encodeURIComponent(repository.split('/')[0]+':'+branch)}&base=main`);
    let pr=matches.find((p:any)=>p.head.sha===receipt.commit);
    if(!pr)pr=await api('POST','pulls',{title:`Publish article: ${record.draft.locales.en.title}`.slice(0,200),head:branch,base:'main',body:`Human-authorized editorial publication.\n\n- Exact version: ${record.articleId} / ${record.version}\n- Digest: ${record.digest}\n- EN, FR and ES committed together.\n- Private render, media and source checks completed.\n- Public confirmation waits for deployment, JSON-LD and sitemaps.`,draft:false});
    job=await savePublicationProgress(ref,'awaiting-ci',{...receipt,pullRequest:pr.number,pullRequestUrl:pr.html_url});
   }
   if(job.status==='awaiting-ci'){
    const pr=await api('GET',`pulls/${job.receipt.pullRequest}`);
    if(pr.head.sha!==job.receipt.commit)throw Error('Publication branch changed after approval');
    if(pr.merged_at)job=await savePublicationProgress(ref,'awaiting-deployment',{...job.receipt,mergeCommit:pr.merge_commit_sha,deploymentStartedAt:new Date().toISOString()});
    else{
     if(pr.mergeable===false)throw Error('Publication merge conflict requires resolution');
     if(pr.state!=='open')throw Error('Publication pull request was closed without merging');
     const [checks,status]=await Promise.all([api('GET',`commits/${job.receipt.commit}/check-runs?per_page=100`),api('GET',`commits/${job.receipt.commit}/status`)]);
     if(checks.total_count>100)throw Error('Publication CI inventory incomplete');
     const polls=Number(job.receipt.ciPolls??0)+1;
     if(polls>36)throw Error('Publication CI wait exceeded 36 service checks');
     job=await savePublicationProgress(ref,'awaiting-ci',{...job.receipt,ciPolls:polls});
     const ci=publicationCiState(checks.check_runs,status.statuses,{mergeable:pr.mergeable,polls});
     if(ci==='failed')throw Error('A publication CI check failed');
     if(ci==='passed'&&pr.mergeable===true){
      const merged=await api('PUT',`pulls/${pr.number}/merge`,{sha:job.receipt.commit,merge_method:'squash'});
      if(!merged.merged)throw Error('Publication merge was not accepted');
      job=await savePublicationProgress(ref,'awaiting-deployment',{...job.receipt,mergeCommit:merged.sha,deploymentStartedAt:new Date().toISOString()});
     }
    }
   }
   if(job.status==='awaiting-deployment'){
    const urls=articleUrls(record);const response=await fetch(urls[0],{cache:'no-store',signal:AbortSignal.timeout(15000)});const html=await response.text();
    if(response.ok&&html.includes(`data-editorial-digest="${record.digest}"`)){
     const views=await inspectArticleViews(record,'https://maxvideoai.com');
     const storedChecks=await getEditorialChecks(record.articleId,record.version);
     const {validateEditorialCheckReport}=await import('../../frontend/lib/editorial/checks');
     validateEditorialCheckReport(record.draft,record.digest,{...(storedChecks!.report as object),views});
     job=await savePublicationProgress(ref,'published',{...job.receipt,urls});
    }else if(Date.now()-Date.parse(job.receipt.deploymentStartedAt??job.requestedAt)>2*60*60*1000)throw Error('Deployment did not become readable within two hours');
   }
   await emit({status:job.status,articleId:job.articleId,version:job.version,pullRequestUrl:job.receipt.pullRequestUrl});
  }catch(e){
   // Preserve receipt after every step; uncertain network results are reconciled via
   // remote branch/PR identity on the next pass, never blindly committed again.
   if(/Publication paused/.test((e as Error).message)){await emit({status:'paused'});return;}
   const current=await getEditorialPublication(ref.articleId,ref.version);
   if(current&&current.status!=='published'){
    const failures=Number(current.receipt.failures??0)+1;
    const transient=/timeout|timed out|fetch failed|response|socket|ECONN|HTTP 5|HTTP 429/i.test((e as Error).message);
    const status=transient&&failures<3?current.status:'blocked';
    await savePublicationProgress(ref,status,{...current.receipt,failures},status==='blocked'?(current.receipt.mergeCommit?'Le déploiement a été demandé, mais les pages ou leur référencement restent à vérifier.':'La mise en ligne attend une vérification technique : '+(/CI/.test((e as Error).message)?'les tests du site ont échoué.':/collision/.test((e as Error).message)?'une adresse d’article est déjà utilisée.':/media/i.test((e as Error).message)?'les illustrations publiques ne sont pas toutes accessibles.':'la connexion ou la réponse du service doit être vérifiée.')):null);
    console.error('Publication worker diagnostic:',(e as Error).message);
    await emit({status,articleId:ref.articleId,version:ref.version});
   }else throw e;
  }
 }finally{await lock.query("SELECT pg_advisory_unlock(hashtext('editorial-publication-worker'))").catch(()=>undefined);lock.release();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>getDb().end());
