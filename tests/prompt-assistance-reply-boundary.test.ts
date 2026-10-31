import assert from 'node:assert/strict';
import test from 'node:test';
import {parsePromptProviderReply} from '../frontend/src/server/prompt-assistance/reply-format';

const version={replyFormat:'destination-v1'};
test('destination gates applicability without classifying text by keywords, timing or action count',()=>{
 const plan='60-second external montage plan.\n00–30: choose real rehearsal footage.\n30–60: build an ending.';
 assert.deepEqual(parsePromptProviderReply(JSON.stringify({kind:'conversation',reply:plan,text:null}),version),{reply:plan,text:null});
 for(const text of [
  'A performer enters, sits, turns, stands and bows. One continuous shot.',
  '00–03: a musician raises a hand. 03–06: she taps the drum and smiles.',
  'Ensayamos durante un minuto. Volvemos a empezar juntos.',
  'Refrain: ensemble, encore une fois.',
 ])assert.deepEqual(parsePromptProviderReply(JSON.stringify({kind:'replacement',reply:'For this editor.',text}),version),{reply:'For this editor.',text});
});
test('only an absent version admits the old shape; present invalid markers never guess a decoder',()=>{
 const old=JSON.stringify({reply:'Historical explanation.',text:'Historical replacement.'});
 assert.deepEqual(parsePromptProviderReply(old,{}),{reply:'Historical explanation.',text:'Historical replacement.'});
 assert.deepEqual(parsePromptProviderReply(old,null),{reply:'Historical explanation.',text:'Historical replacement.'});
 for(const replyFormat of [undefined,null,false,0,'',[],{},'destination-v999'])assert.throws(()=>parsePromptProviderReply(old,{replyFormat}));
 assert.throws(()=>parsePromptProviderReply(old,version),'new format cannot fall back after tag validation fails');
 assert.throws(()=>parsePromptProviderReply(JSON.stringify({kind:'replacement',reply:'New format',text:'A prompt.'}),{}),'legacy cannot infer the new decoder from a tag');
});
test('contradictions, malformed bodies and public limits fail before a replacement can escape',()=>{
 for(const body of [
  {kind:'conversation',reply:'Advice',text:'Must not escape.'},
  {kind:'replacement',reply:'A question?',text:null},
  {kind:'replacement',reply:'Done',text:' '},
  {kind:'conversation',reply:' ',text:null},
  {kind:'conversation',reply:'Advice',text:null,extra:true},
  {kind:'replacement',reply:'Done',text:'x'.repeat(50001)},
  {kind:'conversation',reply:'x'.repeat(6001),text:null},
 ])assert.throws(()=>parsePromptProviderReply(JSON.stringify(body),version));
 assert.throws(()=>parsePromptProviderReply('not JSON',version));
});
