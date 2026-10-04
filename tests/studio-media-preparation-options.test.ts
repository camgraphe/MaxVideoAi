import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import type {ToolAssetRef} from '../frontend/src/lib/toolbox/contract';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {normalizeAudioGenerationRequest} from '../frontend/src/server/agent-api/audio-normalization';
import {buildPaidVideoRequestBody} from '../frontend/src/server/agent-api/paid-video-request-body';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import type {AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';
import {studioMediaRequest, studioMotionSource, type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {studioVisualCapabilityDetails,studioAudioCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';

const actor = {authMethod: 'studio-session' as const, userId: 'owner', projectId: 'film', clientId: null};
const image = {type: 'asset' as const, kind: 'image' as const, assetId: 'ma_' + '1'.repeat(32)};
const output = {type: 'job-output' as const, kind: 'image' as const, jobId: 'accepted-job', outputId: 'ready-output'};
const input = {requestId: '00000000-0000-4000-8000-000000000001', message: 'Create a film', references: [image.assetId]};
const video = {action: 'video.prepare', reply: 'Review the quote.', prompt: 'Slow push in, warm light', aspectRatio: '16:9', source: null};
const voice = {action: 'voice.prepare', reply: 'Review the quote.', script: 'Your story starts with a conversation.', language: 'english'};
const music = {action: 'music.prepare', reply: 'Review the quote.', prompt: 'Warm instrumental piano, no vocals', mood: 'dreamy'};

function videoCapability(id: string): AgentPublicGenerationEngine {
  const entry = getFalEngineById(id);
  assert.ok(entry, `The fixture requires a real catalog model: ${id}`);
  const modes = entry.modes.filter(mode => ['t2v', 'i2v', 'ref2v', 'fl2v'].includes(mode.mode));
  return {engine: entry.engine, surface: 'video', publicModes: modes.map(mode => mode.mode) as AgentPublicGenerationEngine['publicModes'],
    modeCaps: Object.fromEntries(modes.map(mode => [mode.mode, mode.ui]))};
}

function factories(catalog = [videoCapability('wan-3'), videoCapability('seedance-2-0-mini'), videoCapability('minimax-h3')], unavailable: string[] = []): StudioMediaFactories {
  // Provider configuration checks are read-only. These fixtures expose complete
  // canonical capabilities while replacing only availability evidence and service I/O.
  const audio = listAudioCapabilities({});
  const modes = audio.modes.map(mode => ({...mode, available: true, variants: mode.variants.map(variant => ({...variant,
    available: !unavailable.includes(String(variant.settings.voiceModel ?? variant.settings.musicModel))}))}));
  return {video: () => ({catalog: async () => catalog}), audio: () => ({catalog: async () => ({...audio, modes})}),
    image: () => {throw new Error('Image preparation is not part of this request.');}} as unknown as StudioMediaFactories;
}

function mediaDependencies(ready: ToolAssetRef[] = [output]) {
  const events: string[] = [];
  return {events, dependencies: {
    readProjectMedia: async () => ready.map(ref => ({ref, name: 'Image output', durationSec: null})),
    resolveMedia: async (_userId: string, ref: ToolAssetRef) => {
      events.push(`resolve:${ref.type === 'asset' ? ref.assetId : ref.outputId}`);
      return {id: ref.type === 'asset' ? ref.assetId : ref.outputId, ref, kind: ref.kind, url: 'https://cdn.maxvideoai.com/image.png',
        thumbUrl: null, previewUrl: null, mime: 'image/png', mediaFacts: {source: 'probe' as const, width: 1280, height: 720}, originalAccess: {type: 'external' as const}};
    },
    saveOutput: async (identity: {userId: string; jobId: string; outputId: string}) => {
      events.push(`save:${identity.jobId}:${identity.outputId}`);
      return {publicId: image.assetId} as never;
    },
  }};
}

test('preparation uses a selected supported non-Wan model and its own omitted defaults', async () => {
  const request = await studioMediaRequest(actor, {...video, modelId: 'minimax-h3', mode: 't2v'} as never, input, factories(), true);
  assert.equal(request.engineId, 'minimax-h3');
  assert.equal(request.mode, 't2v');
  assert.equal(request.settings.durationSec, 10);
  assert.equal(request.settings.resolution, '2K');
  assert.equal(request.settings.aspectRatio, '16:9');
  assert.equal(Object.hasOwn(request.settings, 'audio'), false, 'Always-generated audio must not receive an unsupported toggle.');
  validateCanonicalGenerationCapabilities(request as CanonicalGenerationRequest, videoCapability('minimax-h3'));
});

test('explicit Wan duration, resolution, audio and ratio override the legacy defaults', async () => {
  const request = await studioMediaRequest(actor, {...video, modelId: 'wan-3', settings: [
    {name: 'durationSec', value: 8}, {name: 'resolution', value: '720p'}, {name: 'audio', value: true}, {name: 'aspectRatio', value: '9:16'},
  ]} as never, input, factories(), true);
  assert.deepEqual(request.settings, {aspectRatio: '9:16', audio: true, durationSec: 8, enablePromptExpansion: true, resolution: '720p'});
  assert.equal(request.outputCount, 1);
  validateCanonicalGenerationCapabilities(request as CanonicalGenerationRequest, videoCapability('wan-3'));
  const legacy = await studioMediaRequest(actor, video as never, input, factories(), true);
  assert.deepEqual(legacy.settings, {aspectRatio: '16:9', audio: false, durationSec: 5, enablePromptExpansion: true, resolution: '480p'});
});

test('a saved eight-second Seedance Mini intent keeps its duration alias through canonical preparation', async () => {
  const {dependencies} = mediaDependencies();
  const action = {...video, modelId: 'seedance-2-0-mini', mode: 'i2v', aspectRatio: '9:16',
    settings: [{name: 'duration', value: 8}, {name: 'resolution', value: '720p'}],
    references: [{ref: output, role: 'first_frame', slot: null}]};
  const saved = structuredClone(action);
  const request = await studioMediaRequest(actor, action as never, input, factories(), true, dependencies) as CanonicalGenerationRequest;
  assert.deepEqual(request.settings, {aspectRatio: '9:16', audio: true, durationSec: 8, resolution: '720p'});
  assert.deepEqual(request.references, [{kind: 'asset', assetId: image.assetId, role: 'first_frame'}]);
  assert.deepEqual(action, saved, 'Preparation must not rewrite an immutable saved intent.');
  validateCanonicalGenerationCapabilities(request, videoCapability('seedance-2-0-mini'));
  const body = buildPaidVideoRequestBody({request, engine: videoCapability('seedance-2-0-mini').engine, quoteId: input.requestId,
    canonicalPricing: {membershipTier: 'member'}, resolvedReferences: [{assetId: image.assetId, role: 'first_frame', mediaKind: 'image',
      storageUrl: 'https://cdn.maxvideoai.com/image.png', mimeType: 'image/png', width: 720, height: 1280, durationSec: null}]});
  assert.equal(body.durationSec, 8);
});

test('duration aliases cannot hide conflicting, invalid or unknown video settings before output promotion', async () => {
  const {dependencies, events} = mediaDependencies();
  for (const settings of [
    [{name: 'duration', value: 8}, {name: 'durationSec', value: 5}],
    [{name: 'duration', value: 30}],
    [{name: 'duration', value: null}],
    [{name: 'duration', value: 8}, {name: 'unknownSetting', value: true}],
  ]) await assert.rejects(studioMediaRequest(actor, {...video, modelId: 'seedance-2-0-mini', mode: 'i2v', settings,
    references: [{ref: output, role: 'first_frame', slot: null}]} as never, input, factories(), true, dependencies), {code: 'PARAMETER_INVALID'});
  assert.equal(events.length, 0, 'Invalid options must fail before accessing or saving the ready output.');
});

test('Wan prompt expansion choices survive Studio preparation and provider request projection', async () => {
  const candidate = videoCapability('wan-3');
  for (const enabled of [true, false]) {
    const request = await studioMediaRequest(actor, {...video, modelId: 'wan-3', settings: [
      {name: 'enablePromptExpansion', value: enabled},
    ]} as never, input, factories(), true) as CanonicalGenerationRequest;
    assert.equal(request.settings.enablePromptExpansion, enabled);
    validateCanonicalGenerationCapabilities(request, candidate);
    const body = buildPaidVideoRequestBody({request, engine: candidate.engine, quoteId: input.requestId,
      canonicalPricing: {membershipTier: 'member'}});
    assert.deepEqual(body.extraInputValues, {enable_prompt_expansion: enabled});
    assert.equal(Object.hasOwn(body, 'enablePromptExpansion'), false);
  }
});

for (const role of ['first_frame', 'last_frame', 'source'] as const) {
  test(`H3 ${role} alone infers image-to-video and retains the selected provider field`, async () => {
    const candidate = videoCapability('minimax-h3');
    const {dependencies} = mediaDependencies();
    const request = await studioMediaRequest(actor, {...video, modelId: candidate.engine.id,
      references: [{ref: image, role, slot: null}],
    } as never, input, factories(), true, dependencies) as CanonicalGenerationRequest;
    assert.equal(request.mode, 'i2v');
    assert.deepEqual(request.references, [{kind: 'asset', assetId: image.assetId, role}]);
    validateCanonicalGenerationCapabilities(request, candidate);
    const body = buildPaidVideoRequestBody({request, engine: candidate.engine, quoteId: input.requestId,
      canonicalPricing: {membershipTier: 'member'}, resolvedReferences: [{
        assetId: image.assetId, role, mediaKind: 'image', storageUrl: 'https://cdn.maxvideoai.com/image.png',
        mimeType: 'image/png', width: 1280, height: 720, durationSec: null,
      }]});
    assert.equal(body[role === 'last_frame' ? 'endImageUrl' : 'imageUrl'], 'https://cdn.maxvideoai.com/image.png');
    assert.deepEqual((body.inputs as {slotId: string}[]).map(value => value.slotId), [role === 'last_frame' ? 'end_image_url' : 'image_url']);
  });
}

test('image reference roles are retained and infer reference-to-video without becoming first frames', async () => {
  const {dependencies, events} = mediaDependencies();
  const request = await studioMediaRequest(actor, {...video, modelId: 'seedance-2-0-mini', references: [{ref: image, role: 'reference', slot: null}]} as never,
    input, factories(), true, dependencies);
  assert.equal(request.mode, 'ref2v');
  assert.deepEqual(request.references, [{kind: 'asset', assetId: image.assetId, role: 'reference'}]);
  assert.ok(events.includes(`resolve:${image.assetId}`));
  assert.ok(!events.some(event => event.startsWith('save:')));
  validateCanonicalGenerationCapabilities(request as CanonicalGenerationRequest, videoCapability('seedance-2-0-mini'));
});

test('advertised image-only reference-to-video minima are executable for each selected model', async () => {
  for (const modelId of ['wan-3','minimax-h3','seedance-2-0-mini']) {
    const details=studioVisualCapabilityDetails(videoCapability(modelId));
    assert.ok(details.surface!=='audio');
    const refs=details.modes.find(mode=>mode.mode==='ref2v')!.references;
    assert.equal(refs[0].required,true,modelId);
    assert.equal(refs[0].min,1,modelId);
    const {dependencies}=mediaDependencies();
    const request=await studioMediaRequest(actor,{...video,modelId,mode:'ref2v',references:[{ref:image,role:'reference',slot:null}]} as never,input,factories(),true,dependencies);
    validateCanonicalGenerationCapabilities(request as CanonicalGenerationRequest,videoCapability(modelId));
    await assert.rejects(studioMediaRequest(actor,{...video,modelId,mode:'ref2v',references:[]} as never,input,factories(),true), {code: 'REFERENCE_REQUIRED'});
  }
});

test('first-frame and last-frame roles keep the exact ready project output identity through promotion', async () => {
  const {dependencies, events} = mediaDependencies();
  const request = await studioMediaRequest(actor, {...video, modelId: 'wan-3', mode: 'i2v', references: [
    {ref: output, role: 'first_frame', slot: null}, {ref: image, role: 'last_frame', slot: null},
  ]} as never, input, factories(), true, dependencies);
  assert.equal(request.mode, 'i2v');
  assert.deepEqual(request.references, [{kind: 'asset', assetId: image.assetId, role: 'first_frame'}, {kind: 'asset', assetId: image.assetId, role: 'last_frame'}]);
  assert.ok(events.includes('save:accepted-job:ready-output'));
});

test('all reference ownership is checked before a ready output is promoted', async () => {
  const {dependencies, events} = mediaDependencies();
  const unattached = {...image, assetId: 'ma_' + '2'.repeat(32)};
  await assert.rejects(studioMediaRequest(actor, {...video, references: [
    {ref: output, role: 'reference', slot: null}, {ref: unattached, role: 'reference', slot: null},
  ]} as never, input, factories(), true, dependencies), {code: 'REFERENCE_INVALID'});
  assert.ok(!events.some(event => event.startsWith('save:')));
  await assert.rejects(studioMotionSource(actor, {...output, outputId: 'guessed'}, input, dependencies), {code: 'REFERENCE_INVALID'});
  assert.ok(!events.some(event => event.startsWith('save:')));
});

test('a repeated ready output in the same reference role fails before promotion', async () => {
  const {dependencies, events} = mediaDependencies();
  await assert.rejects(studioMediaRequest(actor, {...video, references: [
    {ref: output, role: 'reference', slot: null}, {ref: output, role: 'reference', slot: null},
  ]} as never, input, factories(), true, dependencies), {code: 'REFERENCE_INVALID'});
  assert.ok(!events.some(event => event.startsWith('save:')));
});

test('explicit unavailable video models and unavailable Audio variants fail closed', async () => {
  await assert.rejects(studioMediaRequest(actor, {...video, modelId: 'unavailable-model'} as never, input, factories(), true), {code: 'ENGINE_UNAVAILABLE'});
  await assert.rejects(studioMediaRequest(actor, {...voice, modelId: 'audio-music-only'} as never, input, factories(), true), {code: 'ENGINE_UNAVAILABLE'});
  await assert.rejects(studioMediaRequest(actor, {...voice, settings: [{name: 'voiceModel', value: 'minimax'}]} as never,
    input, factories(undefined, ['minimax']), true), {code: 'ENGINE_UNAVAILABLE'});
  await assert.rejects(studioMediaRequest(actor, {...music, settings: [{name: 'musicModel', value: 'pro'}]} as never,
    input, factories(undefined, ['pro']), true), {code: 'ENGINE_UNAVAILABLE'});
});

test('duplicate settings, conflicting source selections and unsupported model settings fail before promotion', async () => {
  const {dependencies, events} = mediaDependencies();
  for (const action of [
    {...video, settings: [{name: 'durationSec', value: 5}, {name: 'durationSec', value: 8}]},
    {...voice, settings: [{name: 'language', value: 'english'}, {name: 'language', value: 'spanish'}]},
    {...video, modelId: 'seedance-2-0-mini', settings: [{name: 'resolution', value: '1080p'}]},
    {...video, settings: [{name: 'durationSec', value: null}]},
  ]) await assert.rejects(studioMediaRequest(actor, action as never, input, factories(), true, dependencies), {code: 'PARAMETER_INVALID'});
  await assert.rejects(studioMediaRequest(actor, {...video, source: output, references: [{ref: image, role: 'reference', slot: null}]} as never,
    input, factories(), true, dependencies), {code: 'REFERENCE_INVALID'});
  await assert.rejects(studioMediaRequest(actor, {...video, mode: 't2v', references: [{ref: output, role: 'first_frame', slot: null}]} as never,
    input, factories(), true, dependencies), {code: 'REFERENCE_INVALID'});
  assert.ok(!events.some(event => event.startsWith('save:')));
});

test('voice preparation preserves canonical voice, output format and language settings', async () => {
  const request = await studioMediaRequest(actor, {...voice, modelId: 'audio-voice-only', settings: [
    {name: 'voiceModel', value: 'seed'}, {name: 'seedAudioVoice', value: 'tracy_es_zh'}, {name: 'seedAudioOutputFormat', value: 'wav'},
    {name: 'seedAudioSampleRate', value: 24000}, {name: 'seedAudioSpeed', value: 1.2}, {name: 'language', value: 'spanish'},
  ]} as never, input, factories(), true);
  assert.deepEqual(request.settings, {language: 'spanish', script: voice.script, seedAudioOutputFormat: 'wav', seedAudioSampleRate: 24000,
    seedAudioSpeed: 1.2, seedAudioVoice: 'tracy_es_zh', voiceModel: 'seed'});
  assert.deepEqual(normalizeAudioGenerationRequest(request), request);
  const minimax = await studioMediaRequest(actor, {...voice, settings: [{name: 'voiceModel', value: 'minimax'}, {name: 'minimaxVoiceId', value: 'Wise_Woman'}, {name: 'seedAudioSpeed', value: 1.06}]} as never,
    input, factories(), true);
  assert.equal(minimax.settings.voiceModel, 'minimax');
  assert.equal(minimax.settings.minimaxVoiceId, 'Wise_Woman');
  assert.equal(minimax.settings.seedAudioSpeed, 1.06);
  assert.equal(Object.hasOwn(minimax.settings, 'seedAudioOutputFormat'), false);
});

test('music preparation preserves selected model, duration, tempo and mood settings', async () => {
  const request = await studioMediaRequest(actor, {...music, modelId: 'audio-music-only', settings: [
    {name: 'musicModel', value: 'pro'}, {name: 'durationSec', value: 60}, {name: 'musicBpm', value: 90}, {name: 'mood', value: 'epic'},
  ]} as never, input, factories(), true);
  assert.deepEqual(request.settings, {durationSec: 60, mood: 'epic', musicBpm: 90, musicModel: 'pro'});
  assert.equal(request.prompt, music.prompt);
  assert.deepEqual(normalizeAudioGenerationRequest(request), request);
});

test('Audio rejects exact-duration narration and parameters incompatible with the selected voice', async () => {
  for (const settings of [
    [{name: 'durationSec', value: 12}],
    [{name: 'voiceModel', value: 'minimax'}, {name: 'seedAudioOutputFormat', value: 'wav'}],
    [{name: 'voiceModel', value: 'seed'}, {name: 'seedAudioSpeed', value: 1.234}],
  ]) await assert.rejects(studioMediaRequest(actor, {...voice, settings} as never, input, factories(), true), {code: 'PARAMETER_INVALID'});
});

test('Audio rejects unsupported Clip duration instead of replacing the explicit choice', async () => {
  await assert.rejects(studioMediaRequest(actor, {...music, settings: [{name: 'musicModel', value: 'clip'}, {name: 'durationSec', value: 60}]} as never,
    input, factories(), true), {code: 'PARAMETER_INVALID'});
});

test('Audio inspection exposes canonical settings scoped to each available variant', async () => {
  const voiceCaps=await factories(undefined,['seed']).audio(actor,{enabled:true}).catalog();
  const voiceDetails=studioAudioCapabilityDetails(voiceCaps,'audio-voice-only');
  assert.ok(voiceDetails?.surface==='audio');
  assert.deepEqual(voiceDetails.options.seedVoices,[]);
  assert.deepEqual(voiceDetails.options.seedFormats,[]);
  assert.deepEqual(voiceDetails.options.seedSampleRates,[]);
  const variant=voiceDetails.modes[0].variants[0];
  assert.deepEqual(variant.fixedOutput,{format:'mp3',sampleRate:44100});
  const preset=variant.parameters.find(parameter=>parameter.key==='minimaxVoiceId')!;
  assert.deepEqual(preset.values,voiceCaps.options.minimaxVoices);
  const request=await studioMediaRequest(actor,{...voice,modelId:'audio-voice-only',settings:[
    {name:'voiceModel',value:'minimax'},{name:preset.key,value:preset.values![0]},
  ]} as never,input,factories(undefined,['seed']),true);
  assert.equal(request.settings.minimaxVoiceId,preset.values![0]);

  const seedCaps=await factories(undefined,['minimax']).audio(actor,{enabled:true}).catalog();
  const seedDetails=studioAudioCapabilityDetails(seedCaps,'audio-voice-only');
  assert.ok(seedDetails?.surface==='audio');
  const speed=seedDetails.modes[0].variants[0].parameters.find(parameter=>parameter.key==='seedAudioSpeed')!;
  assert.deepEqual([speed.min,speed.max],[0.5,2]);
  const seeded=await studioMediaRequest(actor,{...voice,settings:[{name:'voiceModel',value:'seed'},{name:speed.key,value:speed.max}]} as never,input,factories(undefined,['minimax']),true);
  assert.equal(seeded.settings.seedAudioSpeed,2);

  const musicCaps=await factories(undefined,['pro']).audio(actor,{enabled:true}).catalog();
  const musicDetails=studioAudioCapabilityDetails(musicCaps,'audio-music-only');
  assert.ok(musicDetails?.surface==='audio');
  assert.deepEqual(musicDetails.modes[0].duration,{source:'requested',minSeconds:30,maxSeconds:30,clipSeconds:30,suggestedSeconds:[30]});
  const duration=musicDetails.modes[0].variants[0].parameters.find(parameter=>parameter.key==='durationSec')!;
  assert.deepEqual(duration.values,[30]);
  const clip=await studioMediaRequest(actor,{...music,settings:[{name:'musicModel',value:'clip'},{name:duration.key,value:duration.values![0]}]} as never,input,factories(undefined,['pro']),true);
  assert.equal(clip.settings.durationSec,30);
  for (const [modelId,action] of [['audio-voice-only',voice],['audio-music-only',music]] as const) {
    const all=factories();
    const details=studioAudioCapabilityDetails(await all.audio(actor,{enabled:true}).catalog(),modelId);
    assert.ok(details?.surface==='audio');
    for (const variant of details.modes[0].variants) {
      const settings=variant.parameters.filter(parameter=>parameter.default!==null).map(parameter=>({name:parameter.key,value:parameter.default}));
      await studioMediaRequest(actor,{...action,modelId,settings} as never,input,all,true);
    }
  }
});
