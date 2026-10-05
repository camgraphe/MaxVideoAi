import assert from 'node:assert/strict';
import test from 'node:test';
import {isWorkspaceModelCertifiedForBlock,isStudioConversationAudioModeCertified} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification';
import {normalizeAudioGenerationRequest,audioRequestToGenerationBody} from '../frontend/src/server/agent-api/audio-normalization';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {prepareAudioRun} from '../frontend/src/server/audio/prepare-audio';
import {buildAudioRunReservation} from '../frontend/src/server/audio/audio-run-reservation';
import {buildAudioVendorCostFacts} from '../frontend/src/lib/audio-generation';
import {generateSongTrack,generateAmbienceTrack} from '../frontend/src/server/audio/providers/standalone';
import {generateClonedVoiceTrack} from '../frontend/src/server/audio/providers/voice-tracks';
import {generateSoundDesignTrack} from '../frontend/src/server/audio/providers/sound-design';

const pricingPolicy={loadOverrides:async()=>({status:'loaded' as const,rules:[],routingRules:[]})};
test('conversation-only song and ambience preserve canonical quote, payload, output and source restrictions',async()=>{
  const cases=[{mode:'song' as const,engineId:'audio-song',settings:{lyrics:'[Verse]\nThe morning arrives.'},provider:'fal-ai/minimax-music/v2.6',cost:15},
    {mode:'ambience_only' as const,engineId:'audio-ambience',settings:{durationSec:60},provider:'fal-ai/stable-audio-25/text-to-audio',cost:20}];
  for(const item of cases){
    assert.equal(isStudioConversationAudioModeCertified(item.engineId,item.mode),true);
    assert.equal(isWorkspaceModelCertifiedForBlock({modelId:item.engineId,presetId:'audio-music',workflowType:'music_generation'}),false,'Canonical conversation qualification must not expose unqualified Canvas controls');
    assert.equal(isWorkspaceModelCertifiedForBlock({modelId:item.engineId,presetId:'audio-voiceover',workflowType:'voiceover_generation'}),false);
    const request=normalizeAudioGenerationRequest({schemaVersion:1,surface:'audio',engineId:item.engineId,mode:item.mode,prompt:'Original warm acoustic sound.',settings:item.settings,references:[],outputCount:1});
    for(const reference of [{role:'source_video',asset:{type:'asset',kind:'video',assetId:'ma_'+'e'.repeat(32)}},{role:'voice_sample',asset:{type:'asset',kind:'audio',assetId:'ma_'+'f'.repeat(32)}}])
      assert.throws(()=>normalizeAudioGenerationRequest({...request,references:[reference]}),'These packs have no source-media connector.');
    const prepared=await prepareAudioRun(audioRequestToGenerationBody(request),'owner',{pricingPolicy});
    const facts=buildAudioVendorCostFacts({...prepared.normalized,durationSec:prepared.durationSec});
    assert.equal(facts.components[0].model,item.provider);assert.equal(facts.vendorSubtotalCents,item.cost);
    assert.ok(prepared.pricingSnapshot.totalCents>=item.cost);assert.equal(prepared.pricingSnapshot.currency,'USD');
    assert.equal(prepared.normalized.outputKind,'audio');
    const reservation=buildAudioRunReservation(prepared,'owner');
    assert.equal(reservation.initialJob.engineId,item.engineId);assert.equal(reservation.execution.initialSettingsSnapshot.outputKind,'audio');
    const calls:{model:string;input:Record<string,unknown>}[]=[];
    const subscribe=async(model:string,input:Record<string,unknown>)=>{calls.push({model,input});return {data:{audio:{url:'https://fixture.example/original.mp3'}},requestId:'injected-dispatch'};};
    const result=item.mode==='song'?await generateSongTrack({prompt:request.prompt,lyrics:request.settings.lyrics!},subscribe):await generateAmbienceTrack({prompt:request.prompt,durationSec:request.settings.durationSec!},subscribe);
    assert.equal(calls.length,1);assert.equal(result.model,item.provider);assert.equal(result.requestId,'injected-dispatch');assert.equal(result.url,'https://fixture.example/original.mp3');
    assert.equal(calls[0].model,item.provider);
    if(item.mode==='song')assert.deepEqual(calls[0].input,{prompt:request.prompt,lyrics:item.settings.lyrics,lyrics_optimizer:false,is_instrumental:false,audio_setting:{format:'mp3',sample_rate:44100,bitrate:256000}});
    else assert.deepEqual(calls[0].input,{prompt:request.prompt+'\nContinuous environmental ambience. No music, speech or singing.',seconds_total:60,num_inference_steps:8,guidance_scale:1});
    let attempts=0;const fail=async()=>{attempts++;throw new Error('Ambiguous provider failure');};
    await assert.rejects(item.mode==='song'?generateSongTrack({prompt:request.prompt,lyrics:request.settings.lyrics!},fail):generateAmbienceTrack({prompt:request.prompt,durationSec:60},fail));
    assert.equal(attempts,1,'Certification never grants an automatic paid retry.');
  }
});

test('Seed clone and cinematic sound design dispatch exact owned URLs to their existing provider routes',async()=>{
  const calls:{model:string;input:Record<string,unknown>}[]=[];
  const subscribe=async(model:string,input:Record<string,unknown>)=>{calls.push({model,input});return {data:{audio:{url:'https://fixture.example/output.mp3'}}};};
  await generateClonedVoiceTrack({script:'Read this exact phrase.',voiceSampleUrl:'https://cdn.maxvideoai.com/owned/voice.mp3',voiceProfile:'balanced',voiceDelivery:'natural',language:'english'},{subscribe});
  assert.equal(calls[0].model,'bytedance/seed-audio-1.0');assert.deepEqual(calls[0].input.audio_urls,['https://cdn.maxvideoai.com/owned/voice.mp3']);
  assert.match(String(calls[0].input.prompt),/@Audio1.*Read this exact phrase/);assert.equal(calls[0].input.voice,undefined);
  await generateSoundDesignTrack({sourceVideoUrl:'https://cdn.maxvideoai.com/owned/source.mp4',durationSec:6,mood:'dreamy',intensity:'subtle',prompt:'Watch clicks.'},{subscribe});
  assert.equal(calls[1].model,'mirelo-ai/sfx-v1.5/video-to-audio');assert.equal(calls[1].input.video_url,'https://cdn.maxvideoai.com/owned/source.mp4');assert.equal(calls[1].input.duration,6);
  assert.equal(calls.length,2);
});


test('Audio conversation qualification uses exact canonical tuples while the five Canvas packs stay unchanged',()=>{
  const capabilities=listAudioCapabilities({FAL_KEY:'fixture-only',GOOGLE_VERTEX_PROJECT_ID:'fixture-only',GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON:'fixture-only'});
  assert.equal(capabilities.modes.length,7);
  for(const mode of capabilities.modes){
    assert.equal(isStudioConversationAudioModeCertified(mode.engineId,mode.mode),true,mode.mode);
    assert.equal(isStudioConversationAudioModeCertified('unqualified-audio-model',mode.mode),false);
    assert.equal(isStudioConversationAudioModeCertified(mode.engineId,'unqualified-mode'),false);
    const other=capabilities.modes.find(candidate=>candidate.mode!==mode.mode)!;
    assert.equal(isStudioConversationAudioModeCertified(mode.engineId,other.mode),false,'Cross-pack identity never qualifies');
  }
  for(const [modelId,presetId,workflowType]of [
    ['audio-music-only','audio-music','music_generation'],['audio-voice-only','audio-voiceover','voiceover_generation'],
    ['audio-sfx-only','audio-sfx','sfx_generation'],['audio-cinematic','audio-sound-design','cinematic_audio'],
    ['audio-cinematic-voice','audio-sound-design-voice','cinematic_voiceover'],
  ] as const)assert.equal(isWorkspaceModelCertifiedForBlock({modelId,presetId,workflowType}),true,modelId);
});
