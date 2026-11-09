/** Setup-only complement for the twelve existing synthetic jobs. No generation or billing calls. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha } from './s3-signature';
export async function completeFixtureJobs(root: string, seed: any, db: any, reportPath: string) {
  const [scope] = await db.query(`SELECT current_database() AS name,current_setting('listen_addresses') AS listeners,current_setting('data_directory') AS directory`);
  assert.match(scope.directory, /\/libqa-[^/]+\/data$/); assert.equal(scope.listeners, '');
  const load = (path: string) => import(pathToFileURL(join(root,path)).href);
  const files = { video:'frontend/app/api/generate/_lib/settings-snapshot.ts', image:'frontend/src/server/images/image-generation-settings-snapshot.ts', audio:'frontend/src/server/audio/audio-generate-snapshots.ts' };
  const video = await load(files.video), image = await load(files.image), audio = await load(files.audio);
  const jobs = [...new Set<string>(seed.outputs.map((o:any)=>o.jobId))].sort();
  assert.equal(jobs.length,12); assert.equal(seed.outputs.length,36);
  assert.ok(jobs.every(id=>/^fixture-job-(?:[0-9]|1[01])$/.test(id)));
  const records = jobs.map(jobId=>{
    const outputs = seed.outputs.filter((o:any)=>o.jobId===jobId).sort((a:any,b:any)=>a.position-b.position);
    assert.ok(outputs.every((o:any)=>o.userId===seed.owners.a));
    const primary=outputs[0], surface=primary.kind, prompt=`Synthetic ${jobId}`;
    const engineId=surface==='video'?'veo-3-1':surface==='image'?'nano-banana':'audio-ambience';
    const engineLabel=surface==='video'?'Veo 3.1':surface==='image'?'Nano Banana':'Ambience';
    const durationSec=Math.max(1,Math.round(primary.durationSec??5));
    let settings: any;
    if(surface==='video') settings=video.buildGenerationSettingsSnapshot({engineId,engineLabel,mode:'t2v',prompt,negativePrompt:null,membershipTier:null,durationSec,durationOption:durationSec,numFrames:null,aspectRatio:'16:9',resolution:'720p',clampedFps:24,rawFps:24,iterationCount:outputs.length,audioEnabled:false,cfgScale:null,isLumaRay2:false,loop:false,shotType:null,seed:null,cameraFixed:null,safetyChecker:null,voiceIds:[],voiceControl:false,multiPrompt:null,extraInputValues:{},normalizedReferenceImages:[],videoUrls:[],endImageUrl:null,elements:null});
    else if(surface==='image') settings=image.buildDefaultSettingsSnapshot({surface,engineEntry:{id:engineId,marketingName:engineLabel},mode:'t2i',prompt,numImages:outputs.filter((o:any)=>o.kind==='image').length,resolvedAspectRatio:'16:9',resolution:'1k',customImageSize:null,normalizedSeed:null,outputFormat:'png',quality:null,background:null,style:null,maskUrl:null,enableWebSearch:false,thinkingLevel:null,limitGenerations:false,watermark:false,imageUrls:[],characterReferences:[],visibility:'private',indexable:false});
    else settings=audio.buildInitialAudioSettingsSnapshot({durationSec,normalized:{pack:'ambience_only',prompt,mood:null,intensity:'medium',durationSec,musicEnabled:false,exportAudioFile:true,outputKind:'audio',script:null,lyrics:null,voiceMode:null},sourceJobId:null,sourceVideoUrl:null});
    return {jobId,userId:seed.owners.a,surface,engineId,engineLabel,durationSec,prompt,settings,
      videoUrl:outputs.find((o:any)=>o.kind==='video')?.url??null,
      audioUrl:outputs.find((o:any)=>o.kind==='audio')?.url??null,
      thumbnail:primary.thumbUrl??'',
      renders:surface==='image'?outputs.filter((o:any)=>o.kind==='image').map((o:any)=>({url:o.url,sourceOutputId:o.id,thumb_url:o.thumbUrl,previewUrl:o.previewUrl,imageDisplay:o.metadata.imageDisplay,width:o.width,height:o.height,mime_type:o.mimeType})):null};
  });
  const migrations=['47_generation_poll_state.sql','53_seedance_draft_links.sql','59_seedance_draft_final_state.sql'];
  const migrationInputs=await Promise.all(migrations.map(async name=>({name,sql:await readFile(join(root,'neon/migrations',name),'utf8')})));
  await db.withDbTransaction(async (tx:any)=>{
    const existing=await tx.query(`SELECT job_id,user_id,status,provider_job_id FROM app_jobs WHERE job_id=ANY($1) FOR UPDATE`,[jobs]);
    assert.equal(existing.length,12);assert.ok(existing.every((r:any)=>r.user_id===seed.owners.a&&r.status==='completed'&&!r.provider_job_id));
    for(const input of migrationInputs) await tx.query(input.sql);
    for(const row of records) await tx.query(`UPDATE app_jobs SET surface=$3,engine_id=$4,engine_label=$5,duration_sec=$6,prompt=$7,
      settings_snapshot=$8::jsonb,video_url=$9,audio_url=$10,thumb_url=$11,render_ids=$12::jsonb,has_audio=$13
      WHERE job_id=$1 AND user_id=$2 AND status='completed' AND provider_job_id IS NULL`,
      [row.jobId,row.userId,row.surface,row.engineId,row.engineLabel,row.durationSec,row.prompt,JSON.stringify(row.settings),row.videoUrl,row.audioUrl,row.thumbnail,row.renders===null?null:JSON.stringify(row.renders),row.surface==='audio']);
  });
  const builderHashes=Object.fromEntries(await Promise.all(Object.entries(files).map(async([role,path])=>[role,sha(await readFile(join(root,path)))])));
  const report={version:1,inputSha256:sha(JSON.stringify(records)),seedSha256:sha(JSON.stringify(seed)),jobs:records,
    migrationHashes:Object.fromEntries(migrationInputs.map(m=>[m.name,sha(m.sql)])),builderHashes,
    changedFields:['surface','engine_id','engine_label','duration_sec','prompt','settings_snapshot','video_url','audio_url','thumb_url','render_ids','has_audio'],
    limits:['Twelve existing completed synthetic jobs; no provider IDs, Draft links, wallet, payment, receipt or quote writes.','Some pre-existing three-output groups contain mixed kinds; surface/settings describe the first output, not a claim of genuine provider generation.','No output IDs, canonical asset rows, media bytes, timestamps or organization state are changed.']};
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  return report;
}
