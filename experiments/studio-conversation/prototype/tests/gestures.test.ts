import test from 'node:test';import assert from 'node:assert/strict';import {trimGesture} from '../shared/gestures';
const clip={id:'clip',assetId:'asset',track:'video' as const,inFrame:24,outFrame:120,startFrame:0,volume:1};
test('pointer trims snap to frames and stop at source and minimum duration without mutating their base',()=>{
 assert.equal(trimGesture(clip,'inFrame',-100,240,24).inFrame,0);
 assert.equal(trimGesture(clip,'inFrame',200,240,24).inFrame,96);
 assert.equal(trimGesture(clip,'outFrame',500,240,24).outFrame,240);
 assert.equal(trimGesture(clip,'outFrame',-500,240,24).outFrame,48);
 assert.equal(trimGesture(clip,'outFrame',1.6,240,24).outFrame,122);
 assert.equal(clip.outFrame,120);
});
