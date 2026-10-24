import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeFluxDraftSubmission,resolveFluxDraftProvenance} from '../frontend/server/flux-draft-provenance';

const endpoints={t2v:'text-to-video',i2v:'image-to-video',fl2v:'first-last-frame-to-video',ref2v:'keyframes-to-video'} as const;
for(const [mode,path] of Object.entries(endpoints))test(`native ${mode} submission proof binds the actual endpoint and complete request`,()=>{
 const endpoint=`blackforestlabs/flux-3/${path}/draft`;
 const body={prompt:'A',image_url:'owned',settings:{safety:2}};
 const proof=nativeFluxDraftSubmission('flux-3-draft',mode,endpoint,body)!;
 assert.ok(proof);assert.notEqual(proof.requestSha256,nativeFluxDraftSubmission('flux-3-draft',mode,endpoint,{...body,prompt:'B'})?.requestSha256);
 assert.deepEqual(proof,nativeFluxDraftSubmission('flux-3-draft',mode,endpoint,{settings:{safety:2},image_url:'owned',prompt:'A'}));
 assert.equal(nativeFluxDraftSubmission('flux-3',mode,endpoint,body),undefined);
 for(const other of ['blackforestlabs/flux-3/extend-video/draft','blackforestlabs/flux-3/draft-enhance','external/model'])assert.equal(nativeFluxDraftSubmission('flux-3-draft',mode,other,body),undefined);
 const events=[{id:'1',status:'enqueue',payload:{engineId:'flux-3-draft',provider:'fal',nativeDraftSubmission:proof}},{id:'2',status:'completed',payload:{}}];
 assert.equal(resolveFluxDraftProvenance({},[],events).provenance.kind,'fal_submission');
 for(const malformed of [events.slice(0,1),events.slice(1),[events[0],events[0],events[1]],[events[1],{...events[0],id:'3'}]])assert.throws(()=>resolveFluxDraftProvenance({},[],malformed));
 assert.throws(()=>resolveFluxDraftProvenance({origin:'external_fal_import'},[],events));
 assert.throws(()=>resolveFluxDraftProvenance({},[{id:1,endpoint,status:'failed'}],events));
});
