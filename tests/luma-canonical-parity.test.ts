import assert from 'node:assert/strict';
import test from 'node:test';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { buildLumaAgentsVideoPayload, summarizeLumaEffectiveControls } from '../frontend/src/server/video-providers/luma-agents/payload';
import { prepareGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-generation';
import { isStudioConversationVideoModeCertified } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
const entry=getFalEngineById('luma-ray-3-2')!;
const candidate={engine:entry.engine,surface:'video',publicModes:entry.modes.map(m=>m.mode),modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))} as AgentPublicGenerationEngine;
function canonical(mode:string,settings:Record<string,unknown>,references:unknown[]=[],extra={}) {
  return normalizeGenerationRequest({schemaVersion:1,surface:'video',engineId:entry.id,mode,prompt:'Private prompt',settings:{...(['t2v','i2v'].includes(mode)?{aspectRatio:'16:9'}:{}),...settings},references,outputCount:1,...extra});
}
const source = {assetId:'ma_'+'a'.repeat(32),role:'source' as const,mediaKind:'video' as const,storageUrl:'https://example.com/private.mp4',width:1280,height:720,durationSec:5,mimeType:'video/mp4',sizeBytes:1000,originalName:'source.mp4'};
function body(request:ReturnType<typeof canonical>){const resolvedReferences=request.references.some(r=>r.kind==='asset')?[source]:undefined;validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences});return buildPaidVideoRequestBody({quoteId:'job-next',request,resolvedReferences,engine:entry.engine,canonicalPricing:{membershipTier:'member'}});}
test('canonical manual controls retain strength and explicit Off through the shared paid body',()=>{
  const request=canonical('v2v',{resolution:'720p',durationSec:5,editControlMode:'manual',editStrength:'adhere_1',editFaceMode:'off'},[{kind:'asset',assetId:source.assetId,role:'source'}]);
  const projected=body(request);
  const payload=buildLumaAgentsVideoPayload({engineId:entry.id,mode:'v2v',prompt:request.prompt,durationSec:5,videoUrl:'https://example.com/private.mp4',extraInputValues:projected.extraInputValues as Record<string,unknown>});
  assert.deepEqual(payload.video.edit,{strength:'adhere_1',controls:{face:{enabled:false}}});
  const summary=summarizeLumaEffectiveControls(payload);
  assert.equal(summary.evidence,'built_payload');assert.equal(summary.strength,'adhere_1');
  assert.doesNotMatch(JSON.stringify(summary),/Private prompt|https|generation_id/);
  assert.throws(()=>body(canonical('v2v',{...request.settings,editControlMode:'automatic'},request.references)));
});
test('canonical creation preserves all 64 indexed keyframes and existing start/end workflows',()=>{
  const refs=Array.from({length:64},(_,slot)=>({kind:'https',mediaKind:'image',role:'reference',slot,url:`https://example.com/${slot}.png`}));
  const projected=body(canonical('t2v',{durationSec:5,resolution:'720p',keyframeIndexes:refs.map((_,i)=>i).join(',')},refs));
  assert.equal((projected.inputs as unknown[]).length,64);
  assert.throws(()=>body(canonical('t2v',{durationSec:5,resolution:'720p',keyframeIndexes:'0'},refs)));
  assert.doesNotThrow(()=>body(canonical('i2v',{durationSec:5,resolution:'720p'},refs.slice(0,2).map(({slot,...ref},i)=>({...ref,role:i?'last_frame':'first_frame'})))));
});
test('MCP and Studio admit application-owned Extend and reject raw provider identity',()=>{
  const request=canonical('extend',{durationSec:5,resolution:'720p',extendDirection:'backward'},[],{operation:'luma-extend',sourceJobId:'job-owned'});
  const projected=body(request);assert.equal(projected.sourceJobId,'job-owned');assert.deepEqual(projected.inputs,[]);
  assert.equal(prepareGenerationInputSchema.safeParse(request).success,true);
  assert.equal(isStudioConversationVideoModeCertified(entry.id,'extend'),true);
  const details=projectAgentModelModeDetails(candidate,'extend');assert.equal(details.sourceGeneration?.requestField,'sourceJobId');assert.equal(details.extensionOutput,undefined);assert.equal('elements' in details.operations![0],false);
  assert.throws(()=>canonical('extend',request.settings,[],{source_generation_id:'provider-private'}));
  assert.throws(()=>body({...request,settings:{...request.settings,loop:true}}));
});
