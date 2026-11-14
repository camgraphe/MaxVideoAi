import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentGenerationRecovery } from '../frontend/src/server/agent-api/generation-status';
import { mapGenerationStatusRecordToAgent } from '../frontend/src/server/generations/agent-generation-policy';

const status = {
  jobId:'aud_saved',surface:'audio' as const,status:'running' as const,progress:8,message:null,
  priceCents:45,currency:'USD',paymentStatus:'paid_wallet',result:null,retryAfterSeconds:5,
};

test('an Audio run requiring review stops automatic host polling without authorizing another attempt', () => {
  const recovery = buildAgentGenerationRecovery({...status,needsAttention:true});
  assert.equal(recovery.retry,null);
  assert.equal(recovery.needsAttention,true);
  assert.equal(recovery.status,'running');
  assert.equal(recovery.savedToLibrary,false);
  assert.equal(buildAgentGenerationRecovery(status).retry?.afterSeconds,5);
});

test('owned recent/status projections flag an interrupted worker without inventing failure or refund', () => {
  const result=mapGenerationStatusRecordToAgent({
    job_id:status.jobId,surface:'audio',status:'running',progress:8,final_price_cents:45,currency:'USD',payment_status:'paid_wallet',
    settings_snapshot:{surface:'audio',audioDispatch:{version:1,state:'processing',observedAt:'2000-01-01T00:00:00.000Z'}},
  } as never);
  assert.ok(result);
  assert.equal(result.needsAttention,true);
  assert.equal(result.retryAfterSeconds,null);
  assert.equal(result.status,'running');
  assert.equal(result.paymentStatus,'paid_wallet');
  assert.ok(result.message);
  assert.equal(buildAgentGenerationRecovery(result).retry,null);
});
