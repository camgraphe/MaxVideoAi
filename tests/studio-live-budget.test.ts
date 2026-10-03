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
