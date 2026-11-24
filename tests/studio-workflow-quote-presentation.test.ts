import assert from 'node:assert/strict';
import test from 'node:test';
import {conversationQuotePresentation} from '../frontend/src/lib/studio/conversation-quote-presentation';
import {normalizeAudioGenerationRequest} from '../frontend/src/server/agent-api/audio-normalization';

test('every audio quote names the operation being purchased, preserving lyrics and narration',()=>{
  const cases=[
    ['sfx_only','audio-sfx-only','Sound effect','A gentle sparkle',{}],
    ['song','audio-song','Song','Light acoustic music',{lyrics:'Our garden blooms because you shine.'}],
    ['ambience_only','audio-ambience','Ambience','Quiet rain',{}],
    ['voice_only','audio-voice-only','Voiceover','',{script:'Find your next adventure.',language:'english'}],
    ['music_only','audio-music-only','Music','Light piano',{}],
  ] as const;
  for(const [mode,engineId,title,prompt,settings] of cases){
    const request=normalizeAudioGenerationRequest({schemaVersion:1,outputCount:1,surface:'audio',mode,engineId,prompt,
      settings:{...(mode==='song'||mode==='voice_only'?{}:{durationSec:30}),mood:'dreamy',...settings},references:[]});
    const shown=conversationQuotePresentation(request,'en');
    assert.equal(shown.title,title);
    assert.equal(shown.operation,'');
    if(mode==='song')assert.match(shown.direction,/Our garden blooms because you shine\./);
    if(mode==='voice_only')assert.equal(shown.direction,'Find your next adventure.');
  }
});

test('a finished video soundtrack quote identifies its source video and cloned voice',()=>{
  const request=normalizeAudioGenerationRequest({schemaVersion:1,outputCount:1,surface:'audio',mode:'cinematic_voice',engineId:'audio-cinematic-voice',prompt:'Light energetic music',
    settings:{script:'Find your next adventure.',language:'english',voiceModel:'seed',durationSec:6,mood:'documentary'},
    references:[{role:'source_video',asset:{type:'asset',assetId:'ma_'+ 'a'.repeat(32),kind:'video'}},
      {role:'voice_sample',asset:{type:'asset',assetId:'ma_'+ 'b'.repeat(32),kind:'audio'}}]});
  const shown=conversationQuotePresentation(request,'en');
  assert.equal(shown.title,'Video soundtrack with voice');
  assert.match(shown.direction,/Find your next adventure\./);
  assert.match(shown.direction,/Light energetic music/);
  assert.match(shown.settings,/6 s/);
  assert.match(shown.settings,/cloned voice/);
  assert.match(shown.referenceSummary,/source video/);
  assert.match(shown.referenceSummary,/voice sample/);
  assert.equal(conversationQuotePresentation(request,'fr').title,'Bande-son vidéo avec voix');
});

test('both cinematic soundtrack quotes identify the existing video and preserve its visuals', () => {
  for (const withVoice of [false, true]) {
    const request = normalizeAudioGenerationRequest({ schemaVersion: 1, outputCount: 1, surface: 'audio',
      mode: withVoice ? 'cinematic_voice' : 'cinematic', engineId: withVoice ? 'audio-cinematic-voice' : 'audio-cinematic',
      prompt: 'Light energetic music',
      settings: { durationSec: 6, mood: 'documentary', ...(withVoice ? { script: 'An adventure begins.', language: 'english' } : {}) },
      references: [{ role: 'source_video', asset: { type: 'asset', assetId: 'ma_' + 'a'.repeat(32), kind: 'video' } }],
    });
    const notes = {
      en: /adds a soundtrack to the existing video.*preserving its visuals/,
      fr: /ajoute une bande-son à la vidéo existante.*conserve ses images/,
      es: /añade una banda sonora al vídeo existente.*conserva sus imágenes/,
    };
    for (const locale of ['en', 'fr', 'es'] as const) {
      const shown = conversationQuotePresentation(request, locale);
      assert.match(shown.operation, notes[locale]);
      assert.doesNotMatch(shown.settings, notes[locale]);
      assert.doesNotMatch(shown.direction, notes[locale]);
    }
  }
});

test('only an explicit Kling Edit setting describes how the source audio is treated', () => {
  const request = { surface: 'video' as const, engineId: 'kling-o3-standard', mode: 'v2v' as const,
    prompt: 'Lighten the background', references: [], outputCount: 1, schemaVersion: 1 as const };
  const labels = {
    en: ['Keep source audio', 'Discard source audio'],
    fr: ['Conserver le son d’origine', 'Retirer le son d’origine'],
    es: ['Conservar el audio original', 'Descartar el audio original'],
  };
  const silent = { en: 'silent', fr: 'sans audio', es: 'sin audio' };
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const [index, keepAudio] of [true, false].entries()) {
      const edit = { ...request, operation: 'kling-edit' as const, settings: { resolution: '720p', keepAudio } };
      assert.equal(conversationQuotePresentation(edit, locale).settings, `720p · ${labels[locale][index]}`);
      assert.equal(conversationQuotePresentation({ ...edit, operation: 'kling-reference' }, locale).settings, '720p');
      assert.equal(conversationQuotePresentation({ ...request, settings: edit.settings }, locale).settings, '720p');
    }
    assert.equal(conversationQuotePresentation({ ...request, operation: 'kling-edit', settings: { resolution: '720p' } }, locale).settings, '720p');
    assert.equal(conversationQuotePresentation({ ...request, operation: 'kling-edit', settings: { resolution: '720p', audio: false } },
      locale).settings, `720p · ${silent[locale]}`);
  }
});

test('extension and edit quotes retain their operation and exact requested settings',()=>{
  for(const [mode,title] of [['extend','Clip extension'],['v2v','Video edit']] as const){
    const shown=conversationQuotePresentation({surface:'video',engineId:'wan-3',mode,prompt:'Continue the slow rotation',
      settings:{durationSec:5,resolution:'720p',aspectRatio:'16:9',audio:false},
      references:[{kind:'asset',assetId:'ma_'+ 'c'.repeat(32),role:'source'}],outputCount:1,schemaVersion:1},'en');
    assert.equal(shown.title,title);
    assert.match(shown.settings,/5 s/);
    assert.match(shown.settings,/720p/);
    assert.match(shown.settings,/silent/);
    assert.match(shown.referenceSummary,/source clip/);
  }
});

test('custom dimensions and a retake time range are visible in the quote settings',()=>{
  const image=conversationQuotePresentation({surface:'image',engineId:'gpt-image-2-5-flare',mode:'t2i',prompt:'A fox astronaut',
    settings:{resolution:'custom',imageWidth:1024,imageHeight:1360,aspectRatio:'3:4'},references:[],outputCount:1,schemaVersion:1},'en');
  assert.match(image.settings,/1024 × 1360 px/);
  const retake=conversationQuotePresentation({surface:'video',engineId:'ltx-2-3',mode:'retake',prompt:'Replace the opening',
    settings:{startTimeSec:0,durationSec:3,resolution:'1080p'},references:[],outputCount:1,schemaVersion:1},'en');
  assert.match(retake.settings,/0–3 s/);
});

test('a video edit displays recorded output timing rather than an ignored request default',()=>{
  const request={surface:'video' as const,engineId:'gemini-omni-flash',mode:'v2v' as const,prompt:'Lighten the background',
    settings:{durationSec:3,resolution:'720p'},references:[],outputCount:1,schemaVersion:1 as const};
  const shown=conversationQuotePresentation(request,'en',3.25);
  assert.match(shown.settings,/3\.25 s/);
  assert.doesNotMatch(shown.settings,/(^| · )3 s/);
});

test('video quotes distinguish a new text generation, regenerated visuals and a separate continuation',()=>{
  const base={surface:'video' as const,engineId:'wan-3',prompt:'The same scene with a walking captain',settings:{durationSec:5,resolution:'720p'},references:[],outputCount:1,schemaVersion:1 as const};
  const extension=conversationQuotePresentation({...base,mode:'extend'},'en');
  assert.match(extension.operation??'',/separate.*continuation/i);
  assert.match(extension.operation??'',/assembl/i);
  assert.match(conversationQuotePresentation({...base,mode:'v2v'},'en').operation??'',/regenerat.*visual/i);
  assert.match(conversationQuotePresentation({...base,mode:'t2v'},'fr').operation??'',/nouvelle.*description/i);
});
