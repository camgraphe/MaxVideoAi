import assert from 'node:assert/strict';
import test from 'node:test';
import {NextRequest} from '../frontend/node_modules/next/server';
import {EXPECTED_VIDEO_PROVIDER_MODES as modes} from './fixtures/video-provider-mode-parity';
import {EXPECTED_VIDEO_SOURCE_FIELDS as fields,EXPECTED_VIDEO_OPERATIONS as operations} from './fixtures/video-provider-field-parity';
import {getBaseEngineIncludingHidden} from '../frontend/src/lib/engines';
import {createEnginesGetHandler} from '../frontend/app/api/engines/_lib/engines-get-handler';
import {coerceFormState} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {summarizeWorkspaceInputSchema} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {resolveVideoOperationEngine} from '../frontend/lib/video-operation';
import type {Mode} from '../frontend/types/engines';

test('actual engines HTTP projection preserves 38-entry ordinary/admin mode, operation and source-field parity',async()=>{
 assert.equal(Object.keys(fields).length,38);assert.deepEqual(Object.keys(fields).sort(),Object.keys(modes).sort());
 const publicEngines=Object.keys(modes).map(id=>getBaseEngineIncludingHidden(id)!);
 for(const admin of [false,true]){
  const handler=createEnginesGetHandler({getPublicConfiguredEnginesByCategory:async()=>publicEngines,
   resolveLaunchCanaryRequestContext:async()=>admin?{access:{allowedModelIds:[]}} as any:null,
   loadAppEngineScoreMap:async()=>({}),loadAppEngineScoreReviewMap:async()=>({}),
   getGenerationEnvironment:()=>({bytePlusEnabled:true,bytePlusApiKey:'fixture',falApiKey:'fixture',providerEnv:{}}),
  });
  const response=await handler(new NextRequest('https://maxvideoai.com/api/engines?category=video'));
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.degraded,undefined);
  for(const engine of body.engines){
   assert.deepEqual([...engine.modes].sort(),[...modes[engine.id]].sort(),`${admin}:${engine.id}: modes`);
   assert.deepEqual(Object.keys(engine.operationCaps??{}).sort(),[...(operations[engine.id]??[])].sort(),`${engine.id}: operations`);
   for(const mode of engine.modes as Mode[]){
    const form=coerceFormState(engine,mode,null),resolved=resolveVideoOperationEngine(engine,mode,form.operation);
    const summary=summarizeWorkspaceInputSchema({selectedEngine:resolved,activeMode:mode,allowsUnifiedVeoFirstLast:engine.id.startsWith('veo-3'),isUnifiedHappyHorse:false,isUnifiedSeedance:engine.id.startsWith('seedance-2'),isUnifiedGeminiOmni:engine.id==='gemini-omni-flash',uiLocale:'en'});
    const authored=[...(resolved.inputSchema?.required??[]),...(resolved.inputSchema?.optional??[])].filter(field=>(!field.modes?.length||field.modes.includes(mode))&&['image','video','audio'].includes(field.type));
    assert.deepEqual(authored.map(field=>`${field.id}:${field.type}:${field.maxCount??1}`).sort(),[...fields[engine.id][mode]].sort(),`${admin}:${engine.id}:${mode}`);
    // Creation deliberately exposes cross-mode inputs to infer the effective mode.
    // Source operations must stay confined to the selected mode's exact inventory.
    if(['v2v','extend','reframe','retake'].includes(mode)) assert.deepEqual(summary.assetFields.map(({field})=>`${field.id}:${field.type}:${field.maxCount??1}`).sort(),[...(engine.id==='gemini-omni-flash'&&mode==='retake'?['image_url:image:1','reference_images:image:10','video_url:video:1']:fields[engine.id][mode])].sort(),`${engine.id}:${mode}: actual UI fields`);
   }
  }
 }
});
test('specialized operations expose only supported prompt, timing and source controls',()=>{
 const expected=[
  ['kling-o3-pro','v2v','kling-edit',true,['video_url','image_urls'],['resolution','enable_safety_checker','shot_type','keep_audio']],
  ['minimax-h3-max','v2v','h3-recast',false,['video_url','reference_image_urls'],['prompt','enhance_realism','resolution','seed','enable_safety_checker']],
  ['minimax-h3-max','v2v','h3-relight',false,['video_url','reference_image_url'],['aspect_ratio','resolution','seed','enable_safety_checker']],
  ['flux-3','v2v','flux-fast-edit',true,['video_url'],['safety_tolerance']],
  ['flux-3-draft','v2v','flux-draft-enhance',false,[],['safety_tolerance']],
  ['ltx-2-3','reframe','ltx23-reframe',false,['video_url'],['resolution','aspect_ratio','enable_safety_checker']],
 ] as const;
 for(const [id,mode,operation,promptRequired,media,controls]of expected){
  const engine=resolveVideoOperationEngine(getBaseEngineIncludingHidden(id)!,mode,operation),caps=engine.operationCaps![operation]!;
  assert.equal(caps.promptRequired,promptRequired);assert.equal(caps.ui.duration,undefined);assert.equal(caps.ui.fps,undefined);assert.equal(caps.ui.audioToggle,false);
  const schema=engine.inputSchema!;assert.deepEqual([...schema.required!,...schema.optional!].filter(f=>['video','image','audio'].includes(f.type)).map(f=>f.id),[...media]);
  assert.deepEqual(schema.optional!.filter(f=>!['video','image','audio'].includes(f.type)).map(f=>f.id).sort(),[...controls].sort());
 }
 const base=getBaseEngineIncludingHidden('flux-3-draft')!;
 assert.ok(base.modes.includes('extend'));assert.ok(base.inputSchema?.required?.some(f=>f.id==='video_url'&&f.modes?.includes('extend'))||base.inputSchema?.optional?.some(f=>f.id==='video_url'&&f.modes?.includes('extend')));
});
