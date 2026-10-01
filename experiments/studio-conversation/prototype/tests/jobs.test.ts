import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {ProjectStore} from '../server/store';import {CommandService} from '../server/commands';import {JobRunner} from '../server/jobs';
test('restart resumes the same output and completion never overwrites an intervening edit',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-resume-'));try{
  const store=new ProjectStore(dir),service=new CommandService(store),p=await store.create();const result=await service.execute(p.id,{requestId:'images',command:{type:'images',count:1}});
  await store.update(p.id,p=>{p.jobs[0].state='running';return p;});
  const runner=new JobRunner(store,async(_p,job)=>{
   await service.execute(p.id,{requestId:'format',expectedRevision:0,command:{type:'settings',settings:{ratio:'9:16'}}});
   return [{id:job.outputIds[0],name:'New image',kind:'image',file:'image.jpg',duration:0,width:100,height:100,hasAudio:false,origin:'demo'}];
  });await runner.recover();await runner.runOnce();
  const loaded=await new ProjectStore(dir).get(p.id);assert.equal(loaded.jobs[0].id,result.jobId);assert.equal(loaded.jobs[0].state,'ready');assert.equal(loaded.settings.ratio,'9:16');assert.equal(loaded.assets[0].id,loaded.jobs[0].outputIds[0]);
  assert.equal(await runner.runOnce(),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('cancellation discards unfinished outputs and failed work can retry with the same IDs',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-cancel-'));try{
  const store=new ProjectStore(dir),service=new CommandService(store),p=await store.create();await service.execute(p.id,{requestId:'queue',command:{type:'images',count:1}});
  const runner=new JobRunner(store,async()=>{throw new Error('FFmpeg unavailable');});await runner.runOnce();let next=await store.get(p.id);assert.equal(next.jobs[0].state,'failed');const id=next.jobs[0].id,out=next.jobs[0].outputIds[0];
  await service.execute(p.id,{requestId:'retry',command:{type:'retry',jobId:id}});await service.execute(p.id,{requestId:'cancel',command:{type:'cancel',jobId:id}});
  assert.equal(await runner.runOnce(),false);next=await store.get(p.id);assert.equal(next.assets.length,0);assert.equal(next.jobs[0].outputIds[0],out);
 }finally{await rm(dir,{recursive:true,force:true});}
});
