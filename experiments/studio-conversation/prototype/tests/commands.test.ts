import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectStore} from '../server/store';
import {CommandService} from '../server/commands';
test('commands are durable, idempotent, serialized and reject stale revisions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-command-'));
 try {
  const store=new ProjectStore(dir),p=await store.create('Test'),service=new CommandService(store);
  const req={requestId:'first',expectedRevision:0,command:{type:'settings' as const,settings:{ratio:'9:16' as const}}};
  const result=await service.execute(p.id,req); assert.equal(result.project.revision,1);
  const reloaded=new CommandService(new ProjectStore(dir));
  const replay=await reloaded.execute(p.id,req);assert.equal(replay.replayed,true);assert.equal(replay.project.revision,1);
  await assert.rejects(()=>reloaded.execute(p.id,{...req,command:{type:'settings',settings:{ratio:'1:1'}}}),/identifiant/i);
  const race=await Promise.allSettled(['a','b'].map(requestId=>service.execute(p.id,{requestId,expectedRevision:1,command:{type:'settings',settings:{fps:30}}})));
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await store.get(p.id)).revision,2);
  await assert.rejects(()=>service.execute(p.id,{requestId:'no-version',command:{type:'settings',settings:{fps:24}}}),/révision/i);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('request replay after restart retains a single job and output identity',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-job-command-'));
 try{
  const store=new ProjectStore(dir),p=await store.create(),service=new CommandService(store);
  const req={requestId:'generation',command:{type:'images' as const,count:3}};
  const first=await service.execute(p.id,req),again=await new CommandService(new ProjectStore(dir)).execute(p.id,req);
  assert.equal(first.jobId,again.jobId);assert.equal(again.project.jobs.length,1);assert.equal(again.project.jobs[0].outputIds.length,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});
