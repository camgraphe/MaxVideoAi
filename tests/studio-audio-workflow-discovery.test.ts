import assert from 'node:assert/strict';
import test from 'node:test';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {studioAudioCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';
import {studioAudioCapabilitySummary} from '../frontend/src/server/studio/conversation-audio-discovery';
import {getAudioPackConfig} from '../frontend/src/lib/audio-generation';
import {resolveAudioRenderDuration,validateAudioGenerateRequest} from '../frontend/src/server/audio/audio-generate-validation';
import {buildAudioMixFilterGraph} from '../frontend/src/server/audio/media';
import {buildVideoPreservingMuxArgs} from '../frontend/src/server/audio/video-mux-args';
import {STUDIO_MEDIA_DIRECTOR_TOOLS} from '../frontend/lib/studio/conversation-media-contract';

const env={FAL_KEY:'test-only',GOOGLE_VERTEX_PROJECT_ID:'test-only',GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON:'test-only'};

test('Audio preparation guidance preserves pack-specific required media and distinguishes new video generation',()=>{
  const tool=STUDIO_MEDIA_DIRECTOR_TOOLS.find(tool=>tool.action==='audio.prepare');
  assert.ok(tool);
  const sourceRequired=listAudioCapabilities(env).modes.filter(mode=>mode.references.sourceVideo==='required');
  assert.deepEqual(sourceRequired.map(mode=>mode.mode),['cinematic','cinematic_voice']);
  assert.match(tool.description,/required, optional or unsupported source_video and voice_sample roles/);
  assert.match(tool.description,/Cinematic packs require source_video/);
  assert.match(tool.description,/new video from an image or prompt, use video_prepare/);
  assert.doesNotMatch(tool.description,/optional source_video or voice_sample roles/);
});

test('cinematic voice discovery identifies the existing-clip soundtrack workflow and its limits',()=>{
  const details=studioAudioCapabilityDetails(listAudioCapabilities(env),'audio-cinematic-voice');
  assert.ok(details?.surface==='audio');
  const workflow=details.modes[0].audioWorkflow;
  assert.ok(workflow,'The existing-clip workflow must be discoverable before choosing a video generation mode.');
  assert.equal(workflow.output,'video_with_new_soundtrack');
  assert.deepEqual(workflow.references,{sourceVideo:'required',voiceSample:'optional_seed_only'});
  assert.deepEqual(workflow.video,{
    stream:'copied_without_reencoding',duration:'source_video',sourceAudio:'replaced_by_generated_mix',
    sourceDurationSec:{min:3,max:10},optionalAudioExport:true,
  });
  assert.equal(workflow.music,'optional');
  assert.deepEqual(workflow.narration,{scriptRequired:true,mayBeTrimmedToSourceDuration:true,lipSync:false});
  for(const variant of details.modes[0].variants){
    assert.equal(variant.voiceSample,variant.settings.voiceModel==='seed'?'optional':'unsupported');
  }
});

test('all seven packs share discovery facts between summary and details without changing the canonical catalog',()=>{
  const catalog=listAudioCapabilities(env);
  const before=JSON.stringify(catalog);
  assert.equal(catalog.modes.length,7);
  for(const mode of catalog.modes){
    const summary=studioAudioCapabilitySummary(mode);
    const details=studioAudioCapabilityDetails(catalog,mode.engineId);
    assert.ok(details?.surface==='audio');
    assert.deepEqual(summary.audioWorkflow,details.modes[0].audioWorkflow);
    assert.deepEqual(summary.modes,[mode.mode]);
    assert.equal(summary.audioWorkflow?.output,getAudioPackConfig(mode.mode).audioOnly?'audio_file':'video_with_new_soundtrack');
    assert.deepEqual(summary.audioWorkflow?.references,{
      sourceVideo:mode.references.sourceVideo,voiceSample:mode.references.voiceSample,
    });
    if(getAudioPackConfig(mode.mode).audioOnly)assert.equal(summary.audioWorkflow?.video,undefined);
    if(mode.mode==='music_only'){
      assert.equal(summary.audioWorkflow?.references.sourceVideo,'optional');
      assert.equal(summary.audioWorkflow?.output,'audio_file','Optional source video does not turn standalone music into a muxed clip.');
    }
    if(mode.mode==='voice_only')assert.equal(summary.audioWorkflow?.narration?.mayBeTrimmedToSourceDuration,false);
  }
  assert.equal(JSON.stringify(catalog),before,'Discovery must not mutate canonical contracts or their pricing revision.');
});

test('Seed clone availability is exact per variant and never promised for MiniMax alone',()=>{
  const catalog=listAudioCapabilities(env);
  for(const mode of catalog.modes){
    if(!getAudioPackConfig(mode.mode).includesVoice)continue;
    for(const variant of mode.variants){
      const request={pack:mode.mode,prompt:'Soundtrack',script:'Hello there.',mood:'dreamy' as const,
        sourceVideoUrl:getAudioPackConfig(mode.mode).requiresVideo?'owned-source-video':undefined,
        voiceModel:variant.settings.voiceModel??undefined,musicModel:variant.settings.musicModel??undefined,
        musicEnabled:variant.settings.musicEnabled,voiceSampleUrl:'owned-voice-sample'};
      if(variant.settings.voiceModel==='seed')assert.equal(validateAudioGenerateRequest(request).voiceMode,'clone');
      else assert.throws(()=>validateAudioGenerateRequest(request),{code:'voice_reference_unsupported'});
    }
    for(const variant of mode.variants)if(variant.settings.voiceModel==='seed')variant.available=false;
    const summary=studioAudioCapabilitySummary(mode);
    const details=studioAudioCapabilityDetails(catalog,mode.engineId);
    assert.ok(details?.surface==='audio');
    assert.equal(summary.audioWorkflow?.references.voiceSample,'unsupported');
    assert.equal(details.modes[0].references.voiceSample,'unsupported');
    assert.ok(!details.references.includes('voice_sample'));
    assert.ok(details.modes[0].variants.every(variant=>variant.voiceSample==='unsupported'));
  }
});

test('unavailable music variants are not advertised as a soundtrack option',()=>{
  const catalog=listAudioCapabilities({FAL_KEY:'test-only'});
  for(const mode of catalog.modes.filter(mode=>getAudioPackConfig(mode.mode).requiresVideo)){
    assert.ok(mode.variants.some(variant=>variant.available));
    assert.equal(studioAudioCapabilitySummary(mode).audioWorkflow?.music,'unavailable');
  }
});

test('cinematic source-duration discovery matches measured-duration validation including fractional boundaries',()=>{
  for(const mode of listAudioCapabilities(env).modes.filter(mode=>getAudioPackConfig(mode.mode).requiresVideo)){
    const bounds=studioAudioCapabilitySummary(mode).audioWorkflow?.video?.sourceDurationSec;
    assert.ok(bounds);
    const resolve=(duration:number|null)=>resolveAudioRenderDuration({pack:mode.mode,requiresVideo:true,
      sourceVideoUrl:'owned-source-video',probedDurationSec:duration,requestedDurationSec:6,script:'Hello there.'});
    for(const duration of [bounds.min,6.75,bounds.max])assert.equal(resolve(duration),Math.round(duration),'The existing stem duration is rounded; the mux preserves the source video timeline.');
    for(const duration of [bounds.min-0.01,bounds.max+0.01])assert.throws(()=>resolve(duration),{code:'source_video_duration_invalid'});
    assert.throws(()=>resolve(null),{code:'source_video_probe_failed'});
  }
});

test('preservation and trimming facts are backed by the existing mux and generated-stem mix',()=>{
  const args=buildVideoPreservingMuxArgs('owned-source.mp4','generated-mix.m4a','result.mp4');
  const maps=args.flatMap((value,index)=>value==='-map'?[args[index+1]]:[]);
  assert.deepEqual(maps,['0:v:0','1:a:0'],'The mux retains the source video but selects only the generated audio mix.');
  assert.equal(args[args.indexOf('-c:v')+1],'copy');
  assert.equal(args[args.indexOf('-af')+1],'apad');
  assert.ok(args.includes('-shortest'));
  const mix=buildAudioMixFilterGraph({hasSoundDesign:true,hasMusic:true,hasVoice:true,targetDurationSec:6.75});
  assert.match(mix,/atrim=0:6\.75/,'Generated stems, including narration, can be cut to the source duration.');
});
