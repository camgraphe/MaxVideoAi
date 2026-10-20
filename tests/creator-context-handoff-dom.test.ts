import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';

test('Studio source actions use released compatible tools, exact owned media and an account-bound handoff without preparing a generation', async()=>{
 const fixture=await mountToolFixture(`
  import {CreatorToolLinks} from './components/library/CreatorToolLinks.client';
  function App(){return <CreatorToolLinks locale="en" asset={{id:'ma_original',kind:'image',url:'https://private.invalid/original.png?signature=exact',thumbUrl:'https://private.invalid/thumb.png'}}/>;}
 `,{
  'next/navigation':'export const useRouter=()=>({push:path=>window.destinations.push(path)});',
  '@/hooks/useRequireAuth':'export const useRequireAuth=()=>({user:window.account?{id:window.account}:null});',
  '@/lib/toolbox/creator-availability':`export const CREATOR_TOOL_IDS=['subtitles','lip-sync','product-photo-editor','product-video-editor','motion-transfer']; export const getReleasedCreatorToolIds=()=>window.released; export const isCreatorToolPublic=id=>window.released.includes(id);`,
 },window=>{window.account='account-a';window.destinations=[];window.released=[];});
 try{
  assert.equal(fixture.w.document.querySelectorAll('button').length,0);
  fixture.w.released=['subtitles','product-photo-editor','product-video-editor','motion-transfer'];await fixture.render();
  const buttons=fixture.w.document.querySelectorAll('button');assert.equal(buttons.length,2);
  await fixture.act(async()=>buttons[0].click());
  const handoff=JSON.parse(fixture.w.sessionStorage.getItem('maxvideoai:media-handoff:v1'));
  assert.equal(handoff.account,'account-a');assert.equal(handoff.destination,'product-photo-editor');
  assert.equal(handoff.asset.id,'ma_original');assert.equal(handoff.asset.url,'https://private.invalid/original.png?signature=exact');
  assert.equal(fixture.w.destinations[0],`/app/tools/product-photo-editor?media=${handoff.token}`);
  assert.equal(fixture.w.requests.length,0);
  fixture.w.account=null;await fixture.render();assert.equal(fixture.w.document.querySelectorAll('button').length,0);
 }finally{await fixture.close();}
});
