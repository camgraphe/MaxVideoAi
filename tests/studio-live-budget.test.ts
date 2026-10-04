import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveLiveCall,settleLiveCall,STUDIO_LIVE_CAP} from '../scripts/qa/studio-live-budget';
test('shared live cap reserves before dispatch and charges the conservative observed upper bound',()=>{
  const start={settled:0,held:0,blocked:false};
  const reserved=reserveLiveCall(start,702_000_000);
  assert.throws(()=>reserveLiveCall(reserved,1));
  const settled=settleLiveCall(reserved,32_000_000);
  assert.deepEqual(settled,{settled:32_000_000,held:0,blocked:false});
  assert.throws(()=>reserveLiveCall({...start,settled:STUDIO_LIVE_CAP-100},101));
  assert.equal(reserveLiveCall({...start,settled:STUDIO_LIVE_CAP-100},100).held,100);
});
test('unknown usage and process interruption retain the reservation and prevent further dispatch',()=>{
  const reserved=reserveLiveCall({settled:0,held:0,blocked:false},702_000_000);
  for(const cost of [null,-1,NaN,702_000_001]) {
    const stopped=settleLiveCall(reserved,cost);
    assert.equal(stopped.held,reserved.held);
    assert.equal(stopped.blocked,true);
    assert.throws(()=>reserveLiveCall(stopped,1));
  }
  assert.throws(()=>reserveLiveCall(JSON.parse(JSON.stringify(reserved)),1));
});
test('an explicitly raised cumulative cap retains earlier spend and still blocks over-budget or unresolved calls',()=>{
  const state={settled:5_100_000_000,held:0,blocked:false,capNanoUsd:15_000_000_000};
  assert.equal(reserveLiveCall(state,702_000_000).settled,5_100_000_000);
  const settled=settleLiveCall(reserveLiveCall(state,702_000_000),32_000_000);
  assert.equal(settled.capNanoUsd,state.capNanoUsd);
  assert.equal(reserveLiveCall(settled,702_000_000).settled,5_132_000_000);
  assert.throws(()=>reserveLiveCall({...state,settled:14_999_999_999},2));
  assert.equal(reserveLiveCall({...state,settled:14_999_999_999},1).held,1);
  for(const capNanoUsd of [-1,0,NaN,Infinity]) assert.throws(()=>reserveLiveCall({...state,capNanoUsd},1));
  assert.throws(()=>reserveLiveCall({...state,held:1},1));
  assert.throws(()=>reserveLiveCall({...state,blocked:true},1));
});
