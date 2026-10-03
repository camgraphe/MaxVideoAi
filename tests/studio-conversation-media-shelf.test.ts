import assert from 'node:assert/strict';
import test from 'node:test';
import {rememberShelfMedia,insertMediaMention,removeMediaMention,readShelfDrag,MEDIA_SHELF_DRAG_TYPE} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_lib/conversation-media-shelf';

const asset = (letter: string,kind: 'image'|'video'|'audio' = 'image') => ({assetId:'ma_'+letter.repeat(32),kind,url:'https://example.com/original'});
test('shelf aliases stay stable for the same asset and never reuse historical labels',()=>{
  const first=rememberShelfMedia([],asset('a'),[{assetId:asset('b').assetId,label:'Image 9'}]);
  assert.equal(first.item.label,'Image 10');
  const second=rememberShelfMedia(first.items,{...asset('a'),name:'Updated name'},[]);
  assert.equal(second.item.label,'Image 10');
  assert.equal(second.items.length,1);
  assert.equal(second.item.name,'Updated name');
  const video=rememberShelfMedia(second.items,asset('c','video'),[]);
  assert.equal(video.item.label,'Video 1');
});
test('inserting and removing a mention preserves the rest of the draft and its exact target',()=>{
  assert.deepEqual(insertMediaMention('Make this brighter','Image 1',5,9),{text:'Make @Image 1 brighter',caret:13});
  assert.equal(removeMediaMention('Use @Image 1 with @Image 10.','Image 1'),'Use  with @Image 10.');
  assert.equal(insertMediaMention('a'.repeat(4000),'Image 1',4000,4000),null);
});
test('media drags contain only a known canonical identity, never a URL or foreign payload',()=>{
  const data = {getData:(type:string)=>type===MEDIA_SHELF_DRAG_TYPE?asset('a').assetId:''};
  assert.equal(readShelfDrag(data,[{...asset('a'),label:'Image 1'}])?.assetId,asset('a').assetId);
  assert.equal(readShelfDrag(data,[]),null);
  assert.equal(readShelfDrag({getData:()=> 'https://example.com/private'},[]),null);
});
