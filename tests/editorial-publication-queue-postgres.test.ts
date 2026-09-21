import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {checkedFixture} from './fixtures/editorial-checks';
import {saveEditorialDraft,approveEditorialVersion,getEditorialVersion} from '../frontend/src/server/editorial/repository';
import {saveEditorialChecks} from '../frontend/src/server/editorial/checks';
import {requestEditorialCorrection} from '../frontend/src/server/editorial/corrections';
import * as publication from '../frontend/src/server/editorial/publication-queue';
import {getDb} from '../frontend/src/lib/db';
const url=process.env.EDITORIAL_TEST_DATABASE_URL;
if(url&&!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname))throw Error('Disposable loopback DB required');
test('publication needs explicit intent and checks; replay, corrections and edits cannot race an active release',{skip:!url},async()=>{
 process.env.DATABASE_URL=url;
 const pool=new Pool({connectionString:url});
 try{
  for(const file of ['49_editorial_drafts','50_editorial_checks','51_editorial_publications'])await pool.query(readFileSync(`neon/migrations/${file}.sql`,'utf8'));
  const {draft,report}=checkedFixture();draft.runKey=randomUUID();draft.topicKey='queue-'+randomUUID();draft.canonicalSlug=draft.locales.en.slug='queue-'+randomUUID();
  // Adapt the fixture's expected canonical for this independently isolated article.
  for(const view of report.views)if(view.locale==='en')view.canonical='https://maxvideoai.com/blog/'+draft.canonicalSlug;
  const ref=await saveEditorialDraft({draft,actor:'test'});report.digest=ref.digest;
  await approveEditorialVersion({...ref,actor:'human'});
  assert.equal(await publication.getEditorialPublication(ref.articleId,1),null);
  await assert.rejects(publication.requestEditorialPublication({...ref,actor:'human'}),/checks/i);
  await saveEditorialChecks(ref.articleId,1,ref.digest,report,'checker');
  const requested=await publication.requestEditorialPublication({...ref,actor:'human'});
  const notices=await publication.pendingPublicationNotifications();
  assert.equal(notices.some(n=>n.articleId===ref.articleId),false); // publication intent supersedes the review notification
  assert.equal(requested.status,'queued');
  assert.equal((await publication.requestEditorialPublication({...ref,actor:'human'})).requestedAt,requested.requestedAt);
  const correction={...ref,requestId:randomUUID(),locale:'fr' as const,message:'Corriger la conclusion de cet article.'};
  await requestEditorialCorrection(correction,'human');
  assert.equal((await publication.getEditorialPublication(ref.articleId,1))?.status,'cancelled');
  await assert.rejects(publication.requestEditorialPublication({...ref,actor:'human'}),/correction/i);
  draft.runKey=randomUUID();const next=await saveEditorialDraft({draft,actor:'test'});report.digest=next.digest;
  await saveEditorialChecks(next.articleId,2,next.digest,report,'checker');
  await publication.requestEditorialPublication({...next,actor:'human'});
  assert.ok((await getEditorialVersion(next.articleId,2))?.approvedAt);
  const claimed=await publication.beginEditorialPublication(next.articleId,2);
  assert.equal(claimed.status,'processing');
  await assert.rejects(requestEditorialCorrection({...correction,version:2,digest:next.digest,requestId:randomUUID()},'human'),/publication/i);
  await assert.rejects(saveEditorialDraft({draft:{...draft,runKey:randomUUID()},actor:'test'}),/publication/i);
  await publication.savePublicationProgress(next,'blocked',{commit:'a'.repeat(40),ciPolls:36});
  assert.equal((await publication.requestEditorialPublication({...next,actor:'human'})).status,'blocked');
  assert.equal((await publication.retryEditorialPublication({...next,actor:'human'})).status,'processing');
  await publication.savePublicationProgress(next,'published',{urls:['https://maxvideoai.com/blog/demo']});
  assert.equal((await publication.pendingPublicationNotifications()).some(n=>n.articleId===next.articleId&&n.status==='published'),true);
  await publication.acknowledgePublicationNotification(next,'published');
  assert.equal((await publication.pendingPublicationNotifications()).some(n=>n.articleId===next.articleId&&n.status==='published'),false);
  await assert.rejects(publication.requestEditorialPublication({...next,digest:'0'.repeat(64),actor:'human'}),/exact/i);
 }finally{await pool.end();await getDb().end();}
});
