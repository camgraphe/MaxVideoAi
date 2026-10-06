import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from '../frontend/node_modules/next/server';
import {handleStudioWorkerCron} from '../frontend/app/api/cron/_lib/studio-worker-handler';

test('paid Studio workers require a configured secret, even with forged cron headers',async()=>{
  let calls=0;
  const run=async()=>{calls++;return true;};
  const env={STUDIO_VERCEL_WORKERS_ENABLED:'true',VERCEL:'1'};
  const forged=new NextRequest('https://maxvideoai.com/api/cron/studio-tasks',{headers:{'x-vercel-cron':'1','user-agent':'vercel-cron/1.0'}});
  assert.equal((await handleStudioWorkerCron(forged,'task',{env,run})).status,401);
  assert.equal((await handleStudioWorkerCron(forged,'task',{env:{...env,CRON_SECRET:'secret'},run})).status,401);
  assert.equal(calls,0);
});
test('an authenticated worker invocation processes one saved item only while hosting is enabled',async()=>{
  let calls=0;
  const run=async()=>{calls++;return true;};
  const req=new NextRequest('https://maxvideoai.com/api/cron/studio-tasks',{headers:{authorization:'Bearer secret'}});
  const disabled=await handleStudioWorkerCron(req,'task',{env:{CRON_SECRET:'secret'},run});
  assert.deepEqual(await disabled.json(),{ok:true,enabled:false,handled:false});assert.equal(calls,0);
  const enabled=await handleStudioWorkerCron(req,'task',{env:{CRON_SECRET:'secret',STUDIO_VERCEL_WORKERS_ENABLED:'true'},run});
  assert.deepEqual(await enabled.json(),{ok:true,enabled:true,handled:true});assert.equal(calls,1);
});
