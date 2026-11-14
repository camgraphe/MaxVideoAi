import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPECTED_VIDEO_PROVIDER_MODES as expected,PROVIDER_PARITY_EXCLUSIONS } from './fixtures/video-provider-mode-parity';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { listPublicAgentModes } from '../frontend/src/server/agent-api/public-engine-policy';
import { isStudioConversationVideoModeCertified } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import { buildComposerModeToggles } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { normalizeVideoOperation } from '../frontend/lib/video-operation';
const sort=(m:readonly string[])=>[...m].sort();
const workflowCopy={generateVideo:'Create',removeAudioToUnlock:'Remove audio',audioUnsupported:'Unsupported',audioLocked:'Locked',audioLockedFallback:'Locked'};
test('independent 38-provider matrix preserves exact native modes, public canonical aliases and Studio conversation certification',()=>{
 assert.equal(Object.keys(expected).length,38);
 for(const [id,modes]of Object.entries(expected)){
  const engine=getFalEngineById(id)!.engine;assert.deepEqual(sort(engine.modes),sort(modes),id);
  const publicModes=modes.filter(m=>!(id==='gemini-omni-flash'&&m==='retake')).map(m=>id==='kling-2-5-turbo'&&m==='i2i'?'i2v_standard':m);
  assert.deepEqual(sort(listPublicAgentModes(engine,'video')),sort(publicModes),`${id}: MCP`);
  for(const mode of publicModes)assert.equal(isStudioConversationVideoModeCertified(id,mode),true,`${id}:${mode}: Studio`);
 }
});
test('expected source actions are tested independently of workspace availability for every audited entry',()=>{
 for(const [id,modes]of Object.entries(expected)){
  const engine=getFalEngineById(id)!.engine;
  const actions=buildComposerModeToggles({selectedEngine:engine,audioWorkflowLocked:false,uiLocale:'en',workflowCopy})?.map(t=>t.mode)??[];
  const required=modes.filter(m=>['v2v','extend','reframe'].includes(m)||((id.startsWith('flux-3')||id==='veo-3-1'||id==='veo-3-1-fast')&&m==='ref2v'));
  for(const mode of required){assert.ok(actions.includes(mode as any),`${id}:${mode}: expected Site action missing`);}
 }

});
test('specialized exclusions never borrow a different model endpoint',()=>{
 assert.ok(PROVIDER_PARITY_EXCLUSIONS['minimax-h3-max'].pending.includes('insert'));
 for(const [engine,mode,operation]of [['flux-3-max','v2v','flux-fast-edit'],['ltx-2-5-pro','reframe','ltx23-reframe'],['ltx-2-3-fast','reframe','ltx23-reframe'],['flux-3','v2v','flux-draft-enhance']])assert.throws(()=>normalizeVideoOperation(engine,mode,operation));
});

import { normalizeEngineId } from '../frontend/src/lib/engine-alias';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
test('29 current, eight legacy and one archived exact-ID model retain their distinct discovery classes',()=>{
 const legacy=['lumaRay2','lumaRay2_flash','kling-2-5-turbo','kling-2-6-pro','happy-horse-1-0','wan-2-6','ltx-2-3-fast','ltx-2-3'];
 const archived=['pika-text-to-video'];
 assert.equal(Object.keys(expected).filter(id=>!legacy.includes(id)&&!archived.includes(id)).length,29);
 assert.equal(legacy.length,8);
 assert.equal(archived.length,1);
 for(const id of Object.keys(expected)){
  const model=getRuntimeModelById(id)!;
  assert.equal(model.lifecycle,archived.includes(id)?'deep_legacy':legacy.includes(id)?'legacy':'current',id);
  assert.equal(model.publication.app.published,!archived.includes(id),id);
  assert.ok(getFalEngineById(id),`${id}: exact historical identity retained`);
 }
 for(const alias of ['pika-text-to-video','pika-image-to-video','pika22'])assert.equal(normalizeEngineId(alias),'pika-text-to-video');
});
