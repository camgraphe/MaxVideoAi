import assert from 'node:assert/strict';
import test from 'node:test';
import {projectStudioConversationQuotes,recordedStudioOutputDuration,type StudioConversationQuoteRow} from '../frontend/src/server/studio/conversation-quote-facts';

test('source-media quote explanations include only bounded canonical price controls',()=>{
  const row:StudioConversationQuoteRow={quoteId:'quote',surface:'audio',quoteState:'prepared',jobId:null,status:null,amountCents:48,currency:'USD',expiresAt:'2026-10-06T00:00:00Z',databaseNow:'2026-10-05T00:00:00Z',modelId:'audio-cinematic-voice',mode:'cinematic_voice',outputCount:1,referenceCount:2,referenceRoles:['source_video','voice_sample'],settings:{musicEnabled:false,exportAudioFile:true,language:'spanish',startTimeSec:0,retakeMode:'replace_audio_and_video',extendPosition:'end',script:'private narration',prompt:'private prompt',voiceUrl:'https://private.invalid/sample',providerAccountId:'private'}};
  const projected=projectStudioConversationQuotes([row])[0].quote!;
  assert.deepEqual(projected.settings,{musicEnabled:false,exportAudioFile:true,language:'spanish',startTimeSec:0,retakeMode:'replace_audio_and_video',extendPosition:'end'});
  assert.doesNotMatch(JSON.stringify(projected),/private|https:/);
  const bad=projectStudioConversationQuotes([{...row,settings:{language:'a'.repeat(65),retakeMode:'https://private.invalid',startTimeSec:-1,musicEnabled:'true',exportAudioFile:null}}])[0].quote!;
  assert.deepEqual(bad.settings,{});
});

test('only recorded positive canonical output duration is projected as a descriptive fact',()=>{
  assert.equal(recordedStudioOutputDuration({canonicalPricing:{meta:{output_duration_sec:3.25}}}),3.25);
  for(const value of [null,{}, {durationSec:3.25}, {canonicalPricing:{meta:{output_duration_sec:'3.25'}}},
    {canonicalPricing:{meta:{output_duration_sec:0}}}, {canonicalPricing:{meta:{output_duration_sec:-1}}},
    {canonicalPricing:{meta:{output_duration_sec:Infinity}}}, {canonicalPricing:{meta:{output_duration_sec:NaN}}}])
    assert.equal(recordedStudioOutputDuration(value),undefined);
});
