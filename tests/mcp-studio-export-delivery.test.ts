import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

// Exercise the OAuth projection with the real storage-prefix and canonical URL
// owner in a fixture environment. Only the external signing operation is doubled.
test('completed OAuth exports renew readable grants only for owned canonical originals and preserve unavailable delivery truthfully',async()=>{
  const frontend = resolve('frontend');
  const base = 'https://export-oauth-fixture.s3.us-east-1.amazonaws.com';
  const fixture = {grants: [] as unknown[]};
  const bundle = await build({absWorkingDir:frontend,stdin:{contents:"export {projectAgentStudioExportJob} from './src/server/agent-api/studio-export';",resolveDir:frontend,loader:'ts'},tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'oauth-export-fixture',setup(builder){
    const stubs:Record<string,string> = {
      '@/lib/db':'export const query = () => {throw Error("Unexpected database read");};',
      '@/lib/schema':'export const ensureAssetSchema = () => {throw Error("Unexpected schema write");};',
      '@/server/studio/conversation-export-command':'export const prepareStudioTimelineExport = () => {throw Error("Unexpected preparation");}; export const confirmStudioTimelineExport=prepareStudioTimelineExport; export const readStudioTimelineExport=prepareStudioTimelineExport; export const asStudioExportAgentError=e=>e;',
    };
    builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:frontend}));
  }}]});
  const module = {exports:{} as any};
  runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require:createRequire(resolve(frontend,'package.json')),fixture,process:{env:{NODE_ENV:'production',S3_BUCKET:'export-oauth-fixture',S3_REGION:'us-east-1',S3_PUBLIC_BASE_URL:base}},URL,Buffer,console});
  const project = module.exports.projectAgentStudioExportJob;
  const source = `${base}/timeline-exports/owner/film.mp4`;
  const job = {id:'export',status:'completed',progress:100,message:null,billing:{amountCents:2,currency:'USD',billingKind:'paid'},artifact:{outputUrl:'/api/studio/timeline-exports/export/media',canonicalOriginalUrl:source,outputAssetId:'asset',sizeBytes:128,mimeType:'video/mp4'}};
  const dependencies = {requestOrigin:'https://maxvideoai.com',readGrant:async(params:any)=>{fixture.grants.push(params);return `${params.url}?X-Amz-Signature=offline-${fixture.grants.length}`;}};
  const first = await project(job,'owner',dependencies);
  const second = await project(job,'owner',dependencies);
  assert.match(first.artifact.outputUrl,/X-Amz-Signature=offline-1$/);
  assert.match(second.artifact.outputUrl,/X-Amz-Signature=offline-2$/);
  assert.doesNotMatch(JSON.stringify(first),/canonicalOriginalUrl|\/api\/studio/);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.grants)),[{url:source,userId:'owner',requestOrigin:'https://maxvideoai.com',method:'GET',expiresInSeconds:300},{url:source,userId:'owner',requestOrigin:'https://maxvideoai.com',method:'GET',expiresInSeconds:300}]);
  const pending = await project({...job,status:'rendering',progress:80},'owner',dependencies);
  assert.equal(pending.artifact,null,'An in-progress job cannot expose a stale artifact as the completed film.');
  assert.equal(fixture.grants.length,2);
  for(const original of [`${base}/timeline-exports/foreign/film.mp4`,`${base}/admin/owner/film.mp4`,`${source}?X-Amz-Signature=old`,'https://forged.example/film.mp4']){
    const refused = await project({...job,artifact:{...job.artifact,canonicalOriginalUrl:original}},'owner',dependencies);
    assert.equal(refused.status,'completed');
    assert.equal(refused.artifact,null);
    assert.equal(refused.artifactDelivery,'unavailable');
  }
  assert.equal(fixture.grants.length,2,'Foreign keys, unsupported prefixes, old grants and unapproved hosts fail before signing.');
  const cookieOnly = await project({...job,artifact:{...job.artifact,canonicalOriginalUrl:undefined}},'owner',dependencies);
  assert.equal(cookieOnly.artifact,null);
  assert.equal(cookieOnly.artifactDelivery,'unavailable','An authenticated Studio path is not promised as readable by an OAuth host.');
  const unavailable = await project(job,'owner',{requestOrigin:'https://maxvideoai.com',readGrant:async()=>{throw new Error('Signer unavailable');}});
  assert.equal(unavailable.status,'completed');
  assert.equal(unavailable.billing.amountCents,2);
  assert.equal(unavailable.artifactDelivery,'unavailable');
  assert.equal(unavailable.artifact,null);
  assert.equal(job.artifact.outputUrl,'/api/studio/timeline-exports/export/media','Projection never mutates the saved job.');
});
