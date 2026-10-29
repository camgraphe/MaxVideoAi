import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

test('retention cron requires a configured secret before cleanup and returns only aggregate results', async () => {
  const api = await import('../frontend/app/api/cron/_lib/assistant-review-retention-handler').catch(()=>null);
  assert.ok(api?.handleAssistantReviewRetentionCron, 'Authenticated retention handler is required');
  let calls = 0;
  const result = {dryRun:false,composer:2,studio:1,notes:3,hasMore:true};
  const run = async () => { calls++; return result; };
  const request = (token?: string) => new NextRequest('http://localhost/api/cron/assistant-review-retention?limit=500&cutoff=tomorrow', { headers: token ? {authorization:`Bearer ${token}`} : {} });
  for (const [env,token] of [[{},undefined],[{CRON_SECRET:' '},' '],[{CRON_SECRET:'secret'},undefined],[{CRON_SECRET:'secret'},'wrong']] as const) {
    assert.equal((await api.handleAssistantReviewRetentionCron(request(token),{env,run})).status,401);
  }
  assert.equal(calls,0);
  const success = await api.handleAssistantReviewRetentionCron(request('secret'),{env:{CRON_SECRET:'secret'},run});
  assert.equal(success.status,200); assert.deepEqual(await success.json(),{ok:true,...result}); assert.equal(calls,1);
  const failed = await api.handleAssistantReviewRetentionCron(request('secret'),{env:{CRON_SECRET:'secret'},run:async()=>{throw new Error('PRIVATE SQL AND DATA');}});
  assert.equal(failed.status,503); assert.doesNotMatch(await failed.text(),/PRIVATE SQL AND DATA/);
});
