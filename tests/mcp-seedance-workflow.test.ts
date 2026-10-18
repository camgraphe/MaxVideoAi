import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { prepareGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-generation';
import { resolveAgentSeedanceWorkflow } from '../frontend/src/server/agent-api/seedance-workflow';

const standard = { surface: 'video', engineId: 'seedance-2-5', mode: 't2v', prompt: 'A wave',
  settings: { durationSec: 5, resolution: '480p', aspectRatio: '16:9', audio: false } };
const link = { draftJobId: 'draft-owned', providerTaskId: 'cgt-secret', providerModelId: 'model-secret', expiresAt: '2099-01-01T00:00:00Z' };
const parent = { prompt: 'Original wave', durationSec: 5, aspectRatio: '16:9', audio: false,
  settings: { inputMode: 't2v', core: { durationSec: 5, resolution: '480p', iterationCount: 1 }, seedanceWorkflow: { step: 'draft' } } };

test('native Draft is explicit and hash-distinct from ordinary 480p; aliases and incompatible requests fail closed', () => {
  const ordinary = normalizeGenerationRequest(standard);
  const draft = normalizeGenerationRequest({ ...standard, seedanceWorkflow: { step: 'draft' } });
  assert.equal(ordinary.seedanceWorkflow, undefined);
  assert.deepEqual(draft.seedanceWorkflow, { step: 'draft' });
  assert.notEqual(hashCanonicalGenerationRequest(draft), hashCanonicalGenerationRequest(ordinary));
  for (const invalid of [{ step: 'draft', providerTaskId: 'forged' }, { step: 'final' }, { step: 'unknown' }]) {
    assert.throws(() => normalizeGenerationRequest({ ...standard, seedanceWorkflow: invalid }));
  }
  for (const change of [{ engineId: 'veo-3' }, { surface: 'image', mode: 't2i' }, { mode: 'fl2v' }, { settings: { resolution: '1080p' } }]) {
    assert.throws(() => normalizeGenerationRequest({ ...standard, ...change, seedanceWorkflow: { step: 'draft' } }));
  }
  assert.throws(() => normalizeGenerationRequest({ ...standard, draft: true }));
});

test('MCP schema permits finalization with only the owned Draft identifier and requires normal request facts otherwise', () => {
  const parsed = prepareGenerationInputSchema.parse({ surface: 'video', engineId: 'seedance-2-5', seedanceWorkflow: { step: 'final', draftJobId: 'draft-owned' } });
  assert.deepEqual(parsed.seedanceWorkflow, { step: 'final', draftJobId: 'draft-owned' });
  assert.throws(() => normalizeGenerationRequest({ surface: 'video', engineId: 'seedance-2-5' }));
  assert.throws(() => prepareGenerationInputSchema.parse({ ...standard, seedanceWorkflow: { step: 'final', draftJobId: 'draft-owned', providerTaskId: 'forged' } }));
});

test('adapter inherits owned final facts, hides provider IDs and rejects foreign, expired or disabled parents', async () => {
  const input = normalizeGenerationRequest({ surface: 'video', engineId: 'seedance-2-5', seedanceWorkflow: { step: 'final', draftJobId: link.draftJobId } });
  const deps = { enabled: true, getOwnedReadyFn: async () => link, readParentFn: async () => parent };
  const result = await resolveAgentSeedanceWorkflow(input, 'owner', deps);
  assert.equal(result.request.prompt, parent.prompt);
  assert.equal(result.request.settings.resolution, '1080p');
  assert.equal(result.request.settings.durationSec, 5);
  assert.equal(result.request.settings.audio, false);
  assert.equal(result.workflow?.seedanceFinal?.providerTaskId, link.providerTaskId);
  assert.ok(!JSON.stringify(result.request).includes('secret'));
  for (const overrides of [{ enabled: false }, { getOwnedReadyFn: async () => null }]) {
    await assert.rejects(resolveAgentSeedanceWorkflow(input, 'other', { ...deps, ...overrides }), /Draft/i);
  }
  assert.deepEqual((await resolveAgentSeedanceWorkflow(normalizeGenerationRequest(standard), 'owner', { enabled: false })).request, normalizeGenerationRequest(standard));
});

test('discovery distinguishes native workflow availability from standard resolutions and exposes the 1080p choice', async () => {
  const { listFalEngines } = await import('../frontend/src/config/falEngines');
  const { getAgentModelDetails } = await import('../frontend/src/server/agent-api/model-details');
  const entries = listFalEngines();
  const deps = { listEngines: async () => entries.map(e => e.engine), surfaceByEngineId: () => 'video' as const,
    isEngineExecutable: () => true, isModeExecutable: () => true, seedanceWorkflowAvailability: () => ({ mcp: true, web: true }) };
  const enabled = (await getAgentModelDetails('seedance-2-5',deps)).seedanceWorkflow!;
  assert.equal(enabled.available,true);
  assert.equal(enabled.draft.resolution,'480p');
  assert.equal(enabled.final.resolution,'1080p');
  assert.equal(enabled.validity.days,7);
  assert.match(enabled.guidance.join(' '),/direct.*1080p/i);
  assert.match(enabled.guidance.join(' '),/ordinary 480p/i);
  const disabled = (await getAgentModelDetails('seedance-2-5',{...deps,seedanceWorkflowAvailability:()=>({mcp:false,web:true})})).seedanceWorkflow!;
  assert.equal(disabled.available,false);
  assert.equal(disabled.webUrl,'https://maxvideoai.com/app');
  const closed = (await getAgentModelDetails('seedance-2-5',{...deps,seedanceWorkflowAvailability:()=>({mcp:false,web:false})})).seedanceWorkflow!;
  assert.equal(closed.webUrl,null);
});

test('native mode discovery is independent of LAS and requires ModelArk readiness', async () => {
  const {ENV}=await import('../frontend/src/lib/env');
  const previous=ENV.SEEDANCE_2_5_BYTEPLUS_MODES;
  ENV.SEEDANCE_2_5_BYTEPLUS_MODES='t2v,i2v,ref2v,v2v,extend';
  try {
  const {listFalEngines} = await import('../frontend/src/config/falEngines');
  const {getAgentModelDetails} = await import('../frontend/src/server/agent-api/model-details');
  const entry = listFalEngines().find(e=>e.id==='seedance-2-5')!;
  const deps = {listEngines:async()=>[entry.engine],surfaceByEngineId:()=> 'video' as const,isEngineExecutable:()=>true,
    isModeExecutable:(_engine:unknown,mode:string)=>mode!=='v2v',isSeedanceWorkflowModeExecutable:()=>true,seedanceWorkflowAvailability:()=>({mcp:true,web:true})};
  const details=await getAgentModelDetails('seedance-2-5',deps);
  assert.equal(details.modes.some(m=>m.mode==='v2v'),false);
  assert.ok(details.seedanceWorkflow?.modes.includes('v2v'));
  assert.ok(details.seedanceWorkflow?.modeDetails?.find(m=>m.mode==='v2v')?.resolutions.includes('1080p'));
  const lasOnly=await getAgentModelDetails('seedance-2-5',{...deps,isModeExecutable:(_engine:unknown,mode:string)=>mode==='v2v',isSeedanceWorkflowModeExecutable:()=>false});
  assert.equal(lasOnly.generationEnabled,true);
  assert.equal(lasOnly.seedanceWorkflow?.available,false);
  assert.deepEqual(lasOnly.seedanceWorkflow?.modes,[]);
  } finally {ENV.SEEDANCE_2_5_BYTEPLUS_MODES=previous;}
});

test('MCP recovery never offers finalization while paid generation is disabled', async () => {
  const {getAgentGenerationStatus}=await import('../frontend/src/server/agent-api/generation-status');
  const result=await getAgentGenerationStatus({jobId:'owned'}, {userId:'owner',clientId:'client',emailVerified:true,authMethod:'oauth'}, {
    paidGenerationEnabled:()=>false,
    readStatus:async()=>({jobId:'owned',surface:'video',status:'completed',progress:100,message:null,priceCents:77,currency:'USD',
      paymentStatus:'paid_wallet',result:null,retryAfterSeconds:null,
      seedanceWorkflow:{step:'draft',draftJobId:'owned',eligibility:'ready',finalizationAvailable:true}}),
  });
  assert.equal(result.seedanceWorkflow?.finalizationAvailable,false);
});


test('workflow mode projection retains the operator allowlist', async () => {
  const {ENV}=await import('../frontend/src/lib/env');
  const {listFalEngines}=await import('../frontend/src/config/falEngines');
  const {seedanceWorkflowCandidate}=await import('../frontend/src/server/agent-api/seedance-workflow-capabilities');
  const entry=listFalEngines().find(e=>e.id==='seedance-2-5')!;
  const previous=ENV.SEEDANCE_2_5_BYTEPLUS_MODES;
  try {
    ENV.SEEDANCE_2_5_BYTEPLUS_MODES='t2v';
    const candidate=seedanceWorkflowCandidate({engineId:entry.id,seedanceWorkflow:{step:'draft'}}, {
      engine:entry.engine,surface:'video',publicModes:['t2v'],modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui])),
    });
    assert.deepEqual(candidate.publicModes,['t2v']);
    ENV.SEEDANCE_2_5_BYTEPLUS_MODES='i2v';
    const imageOnly=seedanceWorkflowCandidate({engineId:entry.id,seedanceWorkflow:{step:'draft'}}, {
      engine:entry.engine,surface:'video',publicModes:['i2v'],seedanceWorkflowModes:['i2v'],
      modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui])),
    });
    assert.deepEqual(imageOnly.publicModes,['i2v'],'native image workflow does not require an enabled text mode');
  } finally { ENV.SEEDANCE_2_5_BYTEPLUS_MODES=previous; }
});

test('missing or differently denominated future final prices never become free finalization or a misleading total', async () => {
  const {readSeedanceWorkflowPrices}=await import('../frontend/src/server/agent-api/seedance-workflow-prices');
  const request=normalizeGenerationRequest({...standard,seedanceWorkflow:{step:'draft'}});
  const pricing={priceCents:77,currency:'USD',membershipTier:'member' as const,pricingSnapshot:{}};
  const missing=await readSeedanceWorkflowPrices(request,'owner',pricing,{}, {priceGeneration:async()=>{throw new Error('Missing independent final tariff');}});
  assert.equal(missing?.draft?.amountCents,77);
  assert.equal(missing?.final,null);
  assert.equal(missing?.total,null);
  assert.equal(missing?.finalPriceStatus,'unavailable');
  const mixed=await readSeedanceWorkflowPrices(request,'owner',pricing,{}, {priceGeneration:async()=>({...pricing,priceCents:888,currency:'EUR'})});
  assert.equal(mixed?.final?.currency,'EUR');
  assert.equal(mixed?.total,null);
  assert.equal(mixed?.separateFinalQuoteRequired,true);
});
