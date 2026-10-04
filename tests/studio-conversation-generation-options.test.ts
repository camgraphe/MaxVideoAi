import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import {imageRequestFromDraft,imageReferenceFingerprintFromReview} from '../frontend/src/server/studio/image-conversation-service';
import {studioReferenceFingerprint} from '../frontend/src/server/agent-api/generation-actor';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {createStudioImageGenerationService,createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';

const input = {requestId: '123e4567-e89b-42d3-a456-426614174000', message: 'You choose the direction, use medium quality.', references: [] as string[]};
const selection = {prompt: 'A sculptural glass ribbon in warm daylight', aspectRatio: '1:1', modelId: 'gpt-image-2', mode: 't2i',
  settings: [{name: 'quality', value: 'medium'}, {name: 'outputFormat', value: 'jpeg'}, {name: 'resolution', value: '1024x1024'}], references: [], outputCount: 1};
function candidate(id: string) {
  const entry = getFalEngineById(id)!;
  assert.ok(entry);
  return {engine: entry.engine, surface: 'image' as const, publicModes: ['t2i' as const, 'i2i' as const], modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui]))};
}

test('image selection survives the action and saved-draft contracts without scope or payment authority', () => {
  const action = actionFromTool('image_prepare', {reply: 'Review this image quote.', ...selection});
  assert.deepEqual(action, {action: 'image.prepare', reply: 'Review this image quote.', ...selection});
  const draft = imageDraftSchema.parse({reply: 'Review this image quote.', image: selection});
  assert.deepEqual(draft.image, selection);
  assert.equal(imageDraftSchema.safeParse({...draft, image: {...selection, userId: 'foreign'}}).success, false);
  assert.throws(() => actionFromTool('image_prepare', {...action, confirmed: true}));
  assert.equal(imageDraftSchema.safeParse({...draft, image: {...selection, settings: [{name: 'quality', value: 'high'}, {name: 'quality', value: 'low'}]}}).success, false);
});

test('image preparation preserves selected model and valid settings as a canonical MCP-equivalent request', () => {
  const catalog = [candidate('gpt-image-2-5-flare'), candidate('gpt-image-2')];
  const request = imageRequestFromDraft({reply: 'Review the quote.', image: selection} as never, input, catalog);
  assert.equal(request.engineId, 'gpt-image-2', 'An explicit selection must not be replaced by the preferred Flare default.');
  assert.deepEqual(request.settings, {aspectRatio: '1:1', quality: 'medium', outputFormat: 'jpeg', resolution: '1024x1024'});
  assert.deepEqual(normalizeGenerationRequest(request), request);
  validateCanonicalGenerationCapabilities(request, catalog[1], {resolvedReferences: []});
  assert.throws(() => imageRequestFromDraft({reply: 'Review.', image: {...selection, modelId: 'unavailable'}} as never, input, catalog), {code: 'ENGINE_UNAVAILABLE'});
  assert.throws(() => imageRequestFromDraft({reply: 'Review.', image: {...selection, settings: [{name: 'inventedSetting',value: true}]}} as never, input, catalog), {code: 'PARAMETER_INVALID'});
  assert.throws(() => imageRequestFromDraft({reply: 'Review.', image: {...selection, settings: [{name: 'quality',value: 'max'}]}} as never, input, catalog), {code: 'PARAMETER_INVALID'});
});

test('selected reference fingerprints preserve the image facts actually reviewed, including canonical roles and order', () => {
  const assetId='ma_'+'a'.repeat(32), extra='ma_'+'b'.repeat(32);
  const reviewed={assetId,role: 'reference' as const,mediaKind: 'image' as const,storageUrl: 'https://example.com/reviewed.png',width: 1024,height: 1024,durationSec: null,mimeType: 'image/png'};
  const request={references: [{kind: 'asset',assetId,role: 'source',slot: 0}]} as never;
  const expected=studioReferenceFingerprint([{...reviewed,role: 'source',slot: 0}]);
  assert.equal(imageReferenceFingerprintFromReview(request,[{...reviewed,assetId: extra},reviewed]),expected);
  assert.notEqual(expected,studioReferenceFingerprint([{...reviewed,storageUrl: 'https://example.com/replaced.png',role: 'source',slot: 0}]), 'A changed image must not become the reviewed snapshot.');
  assert.throws(()=>imageReferenceFingerprintFromReview(request,[]),{code: 'REFERENCE_INVALID'});
  assert.equal(imageReferenceFingerprintFromReview({references: []} as never,[reviewed]),studioReferenceFingerprint([]));
});

test('selected attached image roles are retained and unselected attachments do not become generation references', () => {
  const assetId = 'ma_' + 'a'.repeat(32);
  const extra = 'ma_' + 'b'.repeat(32);
  const image = {...selection, mode: 'i2i', references: [{ref: {type: 'asset', assetId, kind: 'image'}, role: 'reference', slot: null}]};
  const request = imageRequestFromDraft({reply: 'Review.', image} as never, {...input, references: [assetId, extra]}, [candidate('gpt-image-2')]);
  assert.equal(request.mode, 'i2i');
  assert.deepEqual(request.references, [{kind: 'asset', assetId, role: 'reference'}]);
  assert.throws(() => imageRequestFromDraft({reply: 'Review.', image} as never, input, [candidate('gpt-image-2')]), {code: 'REFERENCE_INVALID'});
  assert.throws(() => imageRequestFromDraft({reply: 'Review.', image: {...image, mode: 't2i'}} as never, {...input, references: [assetId]}, [candidate('gpt-image-2')]), {code: 'REFERENCE_INVALID'});
});

test('the director can inspect exact model details and returns the entire selected draft', async () => {
  const calls = [
    {name: 'catalog_read', args: {}},
    {name: 'model_details', args: {modelId: 'gpt-image-2'}},
    {name: 'image_prepare', args: {reply: 'I chose a simple glass composition. Review its quote.', ...selection}},
  ];
  let index = 0;
  let toolNames: string[] = [];
  const director = createStudioConversationDirector({createResponse: async params => {
    toolNames = params.tools!.map(tool => 'name' in tool ? tool.name : '');
    const call = calls[index++];
    return {id: 'response-' + index, model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage: null, output_text: '',
      output: [{type: 'function_call', name: call.name, call_id: 'call-' + index, arguments: JSON.stringify(call.args)}]};
  }});
  const draft = await director({message: input.message, references: [], history: [], project: {name: 'Film', revision: 0, memory: {revision: 0, brief: '', decisions: []}},
    checkpoint: async (_index, create) => create(), execute: async (_callId, action) => ({ok: true, action: action.action, data: action.action === 'image.prepare' ? {quoteId: 'quote', confirmationRequired: true} : {modelId: 'gpt-image-2'}} as never)});
  assert.equal(index, 3);
  assert.deepEqual(draft.image, selection);
  assert.ok(toolNames.includes('model_details'));
  assert.ok(!toolNames.some(name => /confirm|shell/.test(name)));
});

test('conversation catalogs include published certified models and expose only image-resolvable modes', async () => {
  const actor = {authMethod: 'studio-session' as const, userId: 'owner', projectId: 'film', clientId: null};
  const image = createStudioImageGenerationService(actor,{enabled: true,prepareDependencies: {listPublicEngines: async () => [candidate('gpt-image-2'),candidate('seedream')]}});
  assert.deepEqual((await image.catalog()).map(item => item.engine.id),['gpt-image-2','seedream']);
  const makeVideo = (id: string) => {const entry=getFalEngineById(id)!; return {engine: entry.engine,surface: 'video' as const,publicModes: ['t2v','i2v','ref2v','fl2v','v2v'] as const, modeCaps: Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};};
  const video = createStudioVideoGenerationService(actor,{enabled: true,prepareDependencies: {listPublicEngines: async () => [makeVideo('wan-3'),makeVideo('seedance-2-0-mini'),makeVideo('minimax-h3'),makeVideo('veo-3-1')] as never}});
  const result = await video.catalog();
  assert.deepEqual(result.map(item=>item.engine.id),['wan-3','seedance-2-0-mini','minimax-h3','veo-3-1']);
  assert.ok(result.every(item=>!item.publicModes.includes('v2v')));
  assert.ok(result.every(item=>item.publicModes.every(mode=>Boolean(item.modeCaps[mode]))), 'Missing schemas must not be advertised.');
  const unsupported=structuredClone(makeVideo('wan-3'));
  unsupported.engine.inputSchema!.required.push({id: 'video_url',label: 'Video source',type: 'video',modes: ['t2v']});
  const limited=createStudioVideoGenerationService(actor,{enabled: true,prepareDependencies:{listPublicEngines:async()=>[unsupported] as never}});
  assert.ok(!(await limited.catalog())[0].publicModes.includes('t2v'),'Modes that require an unsupported media resolver must not be advertised.');
});

test('Studio model details intersect canonical reference limits with the conversation attachment budget', () => {
  const details=studioVisualCapabilityDetails(candidate('gpt-image-2-5-flare'));
  assert.ok(details.surface!=='audio');
  assert.equal(details.maxReferences,8);
  assert.equal(details.modes.find(mode=>mode.mode==='i2i')?.references.find(ref=>ref.roles.includes('reference'))?.max,8);
});

test('omitted image resolution follows each selected format instead of defaulting new ratios to portrait', () => {
  for (const [aspectRatio,resolution] of [['1:1','1024x1024'],['16:9','landscape_16_9'],['9:16','portrait_16_9'],['4:3','landscape_4_3'],['3:4','portrait_4_3'],['auto','landscape_4_3']]) {
    const request=imageRequestFromDraft({reply: 'Review.',image: {...selection,aspectRatio,settings: []}} as never,input,[candidate('gpt-image-2')]);
    assert.equal(request.settings.resolution,resolution,aspectRatio);
  }
});

test('explicit image dimensions select custom resolution when the director omits it', () => {
  const catalog = [candidate('gpt-image-2-5-flare')];
  const image = {...selection, modelId: 'gpt-image-2-5-flare', aspectRatio: '3:4', settings: [
    {name: 'imageWidth', value: 1024}, {name: 'imageHeight', value: 1360},
    {name: 'quality', value: 'high'}, {name: 'outputFormat', value: 'png'},
  ]};
  const request = imageRequestFromDraft({reply: 'Review the character reference.', image} as never, input, catalog);
  assert.deepEqual(request.settings, {aspectRatio: '3:4', resolution: 'custom', imageWidth: 1024, imageHeight: 1360, quality: 'high', outputFormat: 'png'});
  validateCanonicalGenerationCapabilities(request, catalog[0], {resolvedReferences: []});
  for (const settings of [
    [{name: 'imageWidth', value: 1024}],
    [{name: 'imageWidth', value: 1024}, {name: 'imageHeight', value: 3}],
    [...image.settings, {name: 'resolution', value: 'portrait_4_3'}],
  ]) assert.throws(() => imageRequestFromDraft({reply: 'Review.', image: {...image, settings}} as never, input, catalog), {code: 'PARAMETER_INVALID'});
});
