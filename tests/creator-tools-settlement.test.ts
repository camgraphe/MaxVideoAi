import assert from 'node:assert/strict';
import test from 'node:test';
import {createCreatorOperationsService,type CreatorOperationsOptions} from '../frontend/src/server/tools/creator-operations';
import type {StoredCreatorOperation} from '../frontend/src/server/tools/creator-operations-store';
const id='12345678-1234-4234-8234-123456789abc';
test('SQL failure recording a published final asset never becomes a failure/refund settlement',async()=>{
  for(const attempts of [0,4,99]){
    const row={id,status:'running',job_id:'fixture-job',quote_state:'accepted',finalize_attempts:attempts,snapshot:{profile:{qualification:'canonical'},input:{toolId:'lip-sync'}}} as StoredCreatorOperation;
    const settlements:unknown[]=[];let published=0;
    const result={toolId:'lip-sync' as const,version:1 as const,jobId:'fixture-job',sourceAssets:[],outputs:[]};
    const sqlFailure=new Error('SQL connection lost while recording success');
    const dependencies:Partial<NonNullable<CreatorOperationsOptions['dependencies']>>={
      read:async()=>row,generation:(()=>({status:async()=>({status:'completed'})})) as NonNullable<CreatorOperationsOptions['dependencies']>['generation'],
      claim:async()=>({token:id,version:attempts+1}),finalize:async()=>{published++;return result;},
      settle:async(_actor,_id,_lease,outcome)=>{settlements.push(outcome);if('result' in outcome)throw sqlFailure;return true;},
    };
    const service=createCreatorOperationsService({authMethod:'toolbox-session',userId:'owner',clientId:null},{enabled:true,dependencies});
    await assert.rejects(service.status(id),error=>error===sqlFailure);
    assert.equal(published,1);assert.deepEqual(settlements,[{result}],'Only success is recorded; SQL errors after publication cannot request a refund, even after many attempts');
  }
});
