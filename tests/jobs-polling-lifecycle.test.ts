import assert from 'node:assert/strict';
import test from 'node:test';
import { mountJobsPolling } from './helpers/jobs-polling-fixture';

const one={id:'one',surface:'video'};

test('closing the final feed releases its pending timers and cannot start another request',async()=>{
  const f=await mountJobsPolling();try{
    await f.render([]);await f.advance(120_000);
    assert.equal(f.statusRequests().length,0);assert.equal(f.timerCount(),0);
  }finally{await f.close();}
});

for(const status of [401,403,404])test(`status ${status} stops retries while preserving the last known job`,async()=>{
  const f=await mountJobsPolling();try{
    f.w.statusResponses=Array(20).fill(status);await f.advance(120_000);
    assert.equal(f.statusRequests().length,1);assert.equal(f.timerCount(),0);
    assert.equal(f.w.feeds.one.stableJobs[0].jobId,'account-A-video');
  }finally{await f.close();}
});

test('transient failures recover on a later attempt and terminal success stops polling',async()=>{
  const f=await mountJobsPolling();try{
    f.w.statusResponses=[503,{status:'pending'},{status:'completed',videoUrl:'https://example.invalid/done.mp4'}];
    await f.advance(120_000);
    assert.equal(f.statusRequests().length,3);assert.equal(f.timerCount(),0);
    assert.equal(f.w.feeds.one.stableJobs[0].status,'completed');
    assert.equal(f.w.feeds.one.stableJobs[0].videoUrl,'https://example.invalid/done.mp4');
  }finally{await f.close();}
});

test('a persistent transient outage has a bounded retry budget while mounted',async()=>{
  const f=await mountJobsPolling();try{
    f.w.statusResponses=Array(100).fill(503);await f.advance(600_000);
    assert.ok(f.statusRequests().length<=5);assert.equal(f.timerCount(),0);
  }finally{await f.close();}
});

test('independent mounted feeds do not remove each other status subscriptions',async()=>{
  const f=await mountJobsPolling([one,{id:'images',surface:'image'}]);try{
    await f.advance(15_000);
    assert.deepEqual(Array.from(f.statusRequests(),(x:any)=>x.url).sort(),['/api/jobs/account-A-image','/api/jobs/account-A-video']);
  }finally{await f.close();}
});

test('two consumers of one job share a timer until the final consumer leaves',async()=>{
  const two={id:'two',surface:'video'};const f=await mountJobsPolling([one,two]);try{
    await f.render([two]);await f.advance(15_000);assert.equal(f.statusRequests().length,1);
    await f.render([]);await f.advance(90_000);assert.equal(f.statusRequests().length,1);assert.equal(f.timerCount(),0);
  }finally{await f.close();}
});

test('an in-flight A failure cannot recreate its timer after switching accounts',async()=>{
  const f=await mountJobsPolling();try{
    f.w.holdStatus=true;await f.advance(15_000);const old=f.statusRequests()[0];
    await f.auth('account-B');await f.respond(old,401,{error:'A expired'});
    f.w.holdStatus=false;await f.advance(120_000);
    assert.equal(f.statusRequests().filter((x:any)=>x.url==='/api/jobs/account-A-video').length,1);
    assert.equal(f.w.feeds.one.stableJobs[0].jobId,'account-B-video');
  }finally{await f.close();}
});

test('a late A status response does not revalidate the new account collection',async()=>{
  const f=await mountJobsPolling();try{
    f.w.holdStatus=true;await f.advance(15_000);const old=f.statusRequests()[0];
    await f.auth('account-B');
    const before=f.w.requests.filter((x:any)=>x.url.startsWith('/api/jobs?')&&x.actor==='account-B').length;
    await f.respond(old,200,{jobId:'account-A-video',status:'completed',videoUrl:'https://example.invalid/A.mp4'});
    assert.equal(f.w.requests.filter((x:any)=>x.url.startsWith('/api/jobs?')&&x.actor==='account-B').length,before);
  }finally{await f.close();}
});

test('explicit Refresh renews an exhausted retry budget without reopening the feed',async()=>{
  const f=await mountJobsPolling();try{
    f.w.statusResponses=Array(5).fill(503);await f.advance(600_000);assert.equal(f.timerCount(),0);
    await f.w.fx.act(async()=>f.w.feeds.one.mutate());
    f.w.statusResponses=[{status:'completed',videoUrl:'https://example.invalid/recovered.mp4'}];
    await f.advance(15_000);assert.equal(f.statusRequests().length,6);
    assert.equal(f.w.feeds.one.stableJobs[0].status,'completed');
  }finally{await f.close();}
});

test('same-account token renewal resumes a denied pending observation',async()=>{
  const f=await mountJobsPolling();try{
    f.w.statusResponses=[401];await f.advance(15_000);assert.equal(f.timerCount(),0);
    await f.w.fx.act(async()=>{for(const fn of f.w.authCallbacks)fn('TOKEN_REFRESHED',{user:{id:'account-A'},access_token:'renewed-A'});});await f.settle();
    f.w.statusResponses=[{status:'completed',videoUrl:'https://example.invalid/renewed.mp4'}];
    await f.advance(15_000);assert.equal(f.statusRequests().length,2);
    assert.equal(f.w.feeds.one.stableJobs[0].status,'completed');
  }finally{await f.close();}
});


test('authenticated polling and completion work when sessionStorage is blocked',async()=>{
  const f=await mountJobsPolling(undefined,{blockedStorage:true});try{
    assert.equal(f.w.feeds.one.stableJobs[0].jobId,'account-A-video');
    f.w.statusResponses=[{status:'completed',videoUrl:'https://example.invalid/private-mode.mp4'}];
    await f.advance(15_000);assert.equal(f.statusRequests().length,1);
    assert.equal(f.w.feeds.one.stableJobs[0].status,'completed');assert.equal(f.timerCount(),0);
  }finally{await f.close();}
});

test('blocked storage cannot let a late account response revalidate a different account',async()=>{
  const f=await mountJobsPolling(undefined,{blockedStorage:true});try{
    f.w.holdStatus=true;await f.advance(15_000);const old=f.statusRequests()[0];assert.ok(old);
    await f.auth('account-B');
    const before=f.w.requests.filter((x:any)=>x.url.startsWith('/api/jobs?')&&x.actor==='account-B').length;
    await f.respond(old,200,{jobId:'account-A-video',status:'completed',videoUrl:'https://example.invalid/A.mp4'});
    assert.equal(f.w.requests.filter((x:any)=>x.url.startsWith('/api/jobs?')&&x.actor==='account-B').length,before);
    assert.equal(f.w.feeds.one.stableJobs[0].jobId,'account-B-video');
  }finally{await f.close();}
});

test('reopening a feed during an old terminal request gives the new owner its own live observation',async()=>{
  const f=await mountJobsPolling();try{
    f.w.holdStatus=true;await f.advance(15_000);const old=f.statusRequests()[0];
    await f.render([]);await f.render([one]);await f.advance(15_000);
    assert.equal(f.statusRequests().length,2,'a retired request must not own the new feed observation');
    const current=f.statusRequests()[1];
    await f.respond(old,200,{jobId:'account-A-video',status:'completed',videoUrl:'https://example.invalid/old.mp4'});
    assert.equal(f.w.feeds.one.stableJobs[0].status,'pending');
    await f.respond(current,200,{jobId:'account-A-video',status:'completed',videoUrl:'https://example.invalid/current.mp4'});
    assert.equal(f.w.feeds.one.stableJobs[0].status,'completed');
    assert.equal(f.w.feeds.one.stableJobs[0].videoUrl,'https://example.invalid/current.mp4');assert.equal(f.timerCount(),0);
  }finally{await f.close();}
});


for(const status of [401,403,404])test(`status ${status} cannot start an unbounded collection retry through SWR defaults`,async()=>{
  const f=await mountJobsPolling(undefined,{defaultRetries:true});try{
    const collections=()=>f.w.requests.filter((r:any)=>r.url.startsWith('/api/jobs?'));
    assert.equal(collections().length,1);
    f.w.collectionStatus=401;f.w.statusResponses=[status];await f.advance(3_600_000);
    assert.equal(f.statusRequests().length,1);
    assert.equal(collections().length,1,'a denied observation must not start automatic collection revalidation');
    f.w.collectionStatus=200;f.w.statusResponses=[{status:'completed',videoUrl:'https://example.invalid/manual-recovery.mp4'}];
    await f.w.fx.act(async()=>f.w.feeds.one.mutate());await f.advance(15_000);
    assert.equal(collections().length,2);assert.equal(f.w.feeds.one.stableJobs[0].status,'completed');
  }finally{await f.close();}
});
