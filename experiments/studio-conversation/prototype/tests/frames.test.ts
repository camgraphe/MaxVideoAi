import test from 'node:test';import assert from 'node:assert/strict';import * as local from '../shared/frames';
test('local conversions stay identical to the existing Studio frame contract',async()=>{
 const path=new URL('../../../../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-frames.ts',import.meta.url);
 const module=await import(path.href),canonical=module.default??module;
 for(const fps of [24,30])for(const seconds of [0,1/24,1,1.12,4.99,60,123.456789]){assert.equal(local.secondsToTimelineFrame(seconds,fps),canonical.secondsToTimelineFrame(seconds,fps));assert.equal(local.timelineFrameToSeconds(Math.round(seconds*fps),fps),canonical.timelineFrameToSeconds(Math.round(seconds*fps),fps));}
 assert.equal(local.MIN_CLIP_DURATION_SEC,canonical.MIN_CLIP_DURATION_SEC);
});
