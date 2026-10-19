import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';
test('Studio sequence caption picker opens the exact saved mix without charging and pins the chosen revision',async()=>{
  const f=await mountToolFixture("import {ConversationSequenceSubtitles} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationSubtitles.client';function App(){return <ConversationSequenceSubtitles projectId='project' sequenceId='sequence' revision={7} busy={false} locale='en' edit={async value=>window.edits.push(value)} attached={window.attached}/>}",{'next/link':"import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);"},w=>{w.edits=[];w.fetch=w.fixtureFetch;});
  try{
    const link=f.w.document.querySelector('a');assert.equal(link.getAttribute('href'),'/app/tools/subtitles?project=project&sequence=sequence&sequenceRevision=7');assert.equal(f.w.requests.length,0);
    await f.act(async()=>f.w.document.querySelector('button').click());assert.equal(f.w.requests[0].url,'/api/tools/subtitles/documents?sequence=sequence');
    await f.respond(f.w.requests[0],{ok:true,documents:[{id:'mix',revision:2,language:'en',segmentCount:4}]});
    await f.act(async()=>{const select=f.w.document.querySelector('select');select.value='mix:2';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
    assert.deepEqual(JSON.parse(JSON.stringify(f.w.edits)),[{kind:'sequence-subtitles',documentId:'mix',revision:2}]);
    f.w.attached={reference:{documentId:'mix',revision:2,audioManifestHash:'a'.repeat(64)},document:null,stale:true};await f.render();
    assert.match(f.w.document.body.textContent,/audio mix changed/);assert.equal(f.w.requests.length,1,'A stale attachment never automatically buys another transcription');
  }finally{await f.close();}
});
