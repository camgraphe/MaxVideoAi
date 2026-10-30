import assert from 'node:assert/strict';
import test from 'node:test';
import {previewReducer,createPreviewState,canApplyProposal} from '../frontend/src/lib/prompt-assistance/preview-state';

test('A clarification can finish without a text proposal; recovered proposals cannot overwrite a new draft',()=>{
  const pending=previewReducer(createPreviewState('owner','draft'),{type:'send',id:1,message:'Help me'});
  const clarified=previewReducer(pending,{type:'reply',id:1,reply:'Which subject should stay?',text:null} as never);
  assert.equal(clarified.proposal,null);
  assert.equal(clarified.pending,null);
  const recovered=previewReducer(clarified,{type:'restored',message:'Earlier message',reply:'Earlier answer',text:'Old prompt'} as never);
  assert.equal(recovered.messages.at(-1)?.text,'Earlier answer');
  assert.equal(canApplyProposal(recovered),false);
});

test('Audio context keeps spoken script separate and video references carry exact media identity',async()=>{
  const adapters=await import('../frontend/src/lib/prompt-assistance/client-context').catch(()=>null);assert.ok(adapters);
  const {newAudioDraft}=await import('../frontend/src/lib/audio-creation');
  const audio=adapters.audioAssistanceContext('voice',{...newAudioDraft('voice'),script:'Keep these spoken words'});
  assert.equal(audio.mode,'voice_only');assert.equal(audio.engineId,'audio-voice-only');
  assert.equal(audio.settings.voiceModel,'eleven-v4');
  assert.ok(!('script' in audio.settings));assert.equal(audio.references.length,0);
  assert.deepEqual(adapters.assistanceSettings({prompt:'Secret draft',durationSec:5,videoUrl:'https://private',nested:{url:'secret'},enabled:true}),{durationSec:5,enabled:true});
});

test('a rejected pre-dispatch message is restored without overwriting newer writing or duplicating the transcript',()=>{
  const sent=previewReducer(createPreviewState('owner','draft'),{type:'send',id:1,message:'Keep the red coat'});
  const restored=previewReducer(sent,{type:'failed',id:1,restore:true} as never);
  assert.equal(restored.message,'Keep the red coat');
  assert.equal(restored.messages.length,0);
  const edited=previewReducer(sent,{type:'message',text:'Keep the blue coat instead'});
  assert.equal(previewReducer(edited,{type:'failed',id:1,restore:true} as never).message,'Keep the blue coat instead');
  assert.equal(previewReducer(sent,{type:'failed',id:1}).message,'','A provider-dispatched failure is never treated as an unsent draft');
});


test('recovering a rejected message after reload preserves newer writing',()=>{
 const empty=createPreviewState('owner','draft');
 assert.equal(previewReducer(empty,{type:'rejected',message:'Recovered original'}).message,'Recovered original');
 const edited=previewReducer(empty,{type:'message',text:'Newer writing'});
 assert.equal(previewReducer(edited,{type:'rejected',message:'Recovered original'}).message,'Newer writing');
});
