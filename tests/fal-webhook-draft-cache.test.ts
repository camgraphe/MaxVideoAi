import assert from 'node:assert/strict';
import test from 'node:test';
import { captureCompletedFalDraftCache } from '../frontend/server/fal-webhook-draft-cache';

test('optional cache capture is native-Draft-only and isolates every recovery failure', async t => {
  const calls:unknown[]=[];const logs:unknown[]=[];
  t.mock.method(console,'info',(...args)=>logs.push(args));
  const job={user_id:'alice',job_id:'draft',engine_id:'flux-3-draft'};
  const recover=async(input:unknown):Promise<never>=>{calls.push(input);throw new Error('private signed provider URL');};
  for(const status of ['running','failed',null])await captureCompletedFalDraftCache(job,status,recover);
  await captureCompletedFalDraftCache({...job,engine_id:'flux-3'},'completed',recover);
  await captureCompletedFalDraftCache({...job,user_id:null},'completed',recover);
  assert.equal(calls.length,0);
  await captureCompletedFalDraftCache(job,'completed',recover);
  assert.deepEqual(calls,[{userId:'alice',sourceJobId:'draft'}]);
  assert.equal(logs.length,1);assert.doesNotMatch(JSON.stringify(logs),/private signed|alice/);
});
