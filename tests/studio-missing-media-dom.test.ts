import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';
import {mediaGridGlobals} from './helpers/media-grid-dom';

const directory = './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/';
const originalId = 'ma_'+'1'.repeat(32), replacementId = 'ma_'+'2'.repeat(32);
const timelineUrl = '/api/studio/projects/film/conversation-timeline';
function view(error = 'MEDIA_DELETED', locked = false) {
  return {data:{projectId:'film',sequenceId:'sequence',revision:4,lockedTracks:locked?['video']:[],clips:[]},
    settings:{fps:30,aspectRatio:'16:9',resolution:'720p'},
    items:[{id:'retained-clip',title:'Original shot',track:'video',startSec:4,durationSec:3,mediaKind:'video',ref:{type:'asset',assetId:originalId,kind:'video'},mediaAccessRequired:true,mediaAccessError:error}]};
}
async function mountTimeline(error = 'MEDIA_DELETED', locked = false) {
  const f = await mountToolFixture(`import {ConversationTimeline} from '${directory}ConversationTimeline.client';
    function App(){return <ConversationTimeline accountKey="owner" projectId="film" projectName="Film" refreshKey={window.refreshKey} onOpenLibrary={()=>{}} onExportChange={()=>{}}/>}`,{
    'next/navigation':'export const useRouter=()=>({push(){}});',
    '../conversation-timeline.module.css':'export default {};',
    './image-reference-library.module.css':'export default {};',
    '@/lib/i18n/I18nProvider':'export const useI18n=()=>({dictionary:{},locale:"en"});',
    '../../../_lib/studio-copy':'export const resolveStudioCopy=()=>({notices:{},viewer:{monitor:{}}});',
    '../../../_shared/_hooks/useWorkspaceTimelinePlayback':'export const useWorkspaceTimelinePlayback=()=>({playheadSec:0,isTimelinePlaying:false,stopTimelinePlayback:window.noop,setPlayheadSec:window.noop,handleToggleTimelinePlayback:window.noop});',
    '../../../_shared/_components/viewer/useProgramPlaybackSync':'export const useProgramPlaybackSync=()=>({});',
    '../../../_shared/_components/viewer/ProgramPlaybackLayers':'export const ProgramPlaybackLayers=()=>null;',
    './ConversationSubtitles.client':'export const ConversationSubtitlePicker=()=>null;export const ConversationSubtitlePreview=()=>null;export const ConversationSequenceSubtitles=()=>null;',
    './ConversationExport.client':'export const ConversationExport=()=>null;',
    '@/lib/owned-auth-fetch':'export const ownedAuthFetch=(url,accountKey,init)=>window.fixtureFetch(url,{...init,accountKey});',
  },w=>{w.noop=()=>{};w.refreshKey=0;w.fetch=w.fixtureFetch;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
    w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
    Object.assign(w,mediaGridGlobals(w));
  });
  await f.respond(f.w.requests[0],{ok:true,result:view(error,locked)});
  return f;
}
type Fixture = Awaited<ReturnType<typeof mountTimeline>>;
async function click(f:Fixture,label:string) {
  const button = [...f.w.document.querySelectorAll('button')].find((node:any)=>node.getAttribute('aria-label')===label||node.textContent.trim()===label) as HTMLButtonElement|undefined;
  assert.ok(button,label);assert.equal(button.disabled,false,label+' should be available');
  await f.act(async()=>{button.click();await new Promise(resolve=>setTimeout(resolve,0));});
}
const edits = (f:Fixture) => f.w.requests.filter((request:any)=>request.url===timelineUrl&&request.init?.method==='POST');
async function applyReplacement(f:Fixture) {
  await click(f,'Replace clip');
  assert.equal(edits(f).length,0,'Canonical library validation must finish before the clip changes.');
  const validation=f.w.requests.findLast((request:any)=>request.url==='/api/media-library/selection/validate');
  assert.ok(validation);
  await f.respond(validation,{ok:true,results:[{reference:{type:'asset',assetId:replacementId,kind:'video'}}]});
}
async function openReplacement(f:Fixture) {
  await click(f,'Select clip Original shot');
  await click(f,'Replace selected clip');
  await f.act(async()=>new Promise(resolve=>setTimeout(resolve,240)));
  const listing = f.w.requests.findLast((request:any)=>request.url.startsWith('/api/media-library/assets?'));
  assert.ok(listing,'Replacement uses the owned library');
  assert.equal(new URL(listing.url,'https://app.invalid').searchParams.get('kind'),'video');
  return listing;
}

test('deleted timeline media stays in place and only an applied library selection submits its exact replacement',async()=>{
  const f=await mountTimeline();
  try {
    const clip=f.w.document.querySelector('[data-timeline-item="retained-clip"]');
    assert.match(clip.textContent,/Media deleted/);
    assert.equal(clip.getAttribute('data-timeline-start'),'4');assert.equal(clip.getAttribute('data-timeline-duration'),'3');
    const listing=await openReplacement(f);
    assert.equal(edits(f).length,0,'Opening the picker must not change the film.');
    await f.respond(listing,{ok:true,assets:[{assetId:replacementId,kind:'video',name:'Replacement',url:'https://cdn.maxvideoai.com/new.mp4',mediaFacts:{source:'probe',durationSec:8}}],nextCursor:null});
    const checkbox=f.w.document.querySelector('.compact-media-check input');assert.ok(checkbox);
    await f.act(async()=>checkbox.click());
    assert.equal(edits(f).length,0,'Selecting a card is staged until Apply.');
    await applyReplacement(f);
    assert.equal(edits(f).length,1);
    const request=JSON.parse(edits(f)[0].init.body);
    assert.equal(request.expectedRevision,4);assert.equal(request.sequenceId,'sequence');
    assert.deepEqual(request.edit,{kind:'replace',clipId:'retained-clip',ref:{type:'asset',assetId:replacementId,kind:'video'},sourceInFrame:0});
    assert.doesNotMatch(JSON.stringify(request),/https:|startFrame|durationFrames/,'Only source identity and offset cross the command boundary.');
    assert.equal(f.w.document.querySelector('dialog'),null);
  } finally {await f.close();}
});

test('a short replacement remains staged without changing the timeline and cancelling is harmless',async()=>{
  const f=await mountTimeline('MEDIA_NOT_AVAILABLE');
  try {
    assert.match(f.w.document.querySelector('[data-timeline-item]').textContent,/Media unavailable/);
    assert.doesNotMatch(f.w.document.body.textContent,/Media deleted/);
    const listing=await openReplacement(f);
    await f.respond(listing,{ok:true,assets:[{assetId:replacementId,kind:'video',name:'Too short',url:'https://cdn.maxvideoai.com/short.mp4',mediaFacts:{source:'probe',durationSec:2.99}}]});
    await f.act(async()=>f.w.document.querySelector('.compact-media-check input').click());
    await applyReplacement(f);
    assert.equal(edits(f).length,0);assert.ok(f.w.document.querySelector('dialog'));
    assert.match(f.w.document.querySelector('dialog').textContent,/too short/i);
    await click(f,'Close library');
    assert.equal(edits(f).length,0);assert.equal(f.w.document.querySelector('dialog'),null);
    assert.equal(f.w.document.querySelector('[data-timeline-item]').getAttribute('data-timeline-start'),'4');
  } finally {await f.close();}
});

test('locked missing clips cannot open replacement or remove their timeline slot',async()=>{
  const f=await mountTimeline('MEDIA_DELETED',true);
  try {
    await click(f,'Select clip Original shot');
    for(const label of ['Replace selected clip','Remove selected clip']) assert.equal(f.w.document.querySelector(`[aria-label="${label}"]`)?.disabled,true,label);
    assert.equal(edits(f).length,0);
  } finally {await f.close();}
});

test('a newer film revision while replacement is staged requires selecting the clip again',async()=>{
  const f=await mountTimeline();
  try {
    const listing=await openReplacement(f);
    await f.respond(listing,{ok:true,assets:[{assetId:replacementId,kind:'video',name:'Replacement',url:'https://cdn.maxvideoai.com/new.mp4',mediaFacts:{source:'probe',durationSec:8}}]});
    await f.act(async()=>f.w.document.querySelector('.compact-media-check input').click());
    f.w.refreshKey++;await f.render();
    const read=f.w.requests.findLast((request:any)=>request.url===timelineUrl+'?preview=1');
    const latest=view();latest.data.revision=5;latest.items[0].startSec=10;
    await f.respond(read,{ok:true,result:latest});
    await applyReplacement(f);
    assert.equal(edits(f).length,0);
    assert.match(f.w.document.querySelector('dialog').textContent,/film changed/i);
    assert.equal(f.w.document.querySelector('[data-timeline-item]').getAttribute('data-timeline-start'),'10');
  } finally {await f.close();}
});

for(const error of ['MEDIA_DELETED','MEDIA_NOT_AVAILABLE','NETWORK_FAILURE']) test('reference card shows '+error+' without exposing stale media or enabling missing-source actions',async()=>{
  const f=await mountToolFixture(`import {ConversationReferenceCard} from '${directory}ConversationReferenceCard.client';
    function App(){return <ConversationReferenceCard projectId="film" item={{assetId:'${originalId}',kind:'video',label:'Video 1',url:'https://cdn.maxvideoai.com/stale.mp4'}} active compact={false} attached locale="en" onSelect={()=>{}} onMention={()=>window.mutations++} onAttach={()=>window.mutations++} onDetach={()=>window.detached++} onInsert={()=>window.mutations++}/>}`,{
      '../conversation-media-shelf.module.css':'export default {};',
      '@/components/tools/CreatorToolLinks.client':'export const CreatorToolLinks=()=>null;',
    },w=>{w.fetch=w.fixtureFetch;w.mutations=0;w.detached=0;w.matchMedia=()=>({matches:false});});
  try {
    if(error==='NETWORK_FAILURE') await f.act(async()=>f.w.requests[0].reject(new Error('offline')));
    else await f.respond(f.w.requests[0],{ok:true,assets:[{assetId:originalId,kind:'video',mediaAccessError:error}]});
    assert.match(f.w.document.body.textContent,error==='MEDIA_DELETED'?/Media deleted/:error==='MEDIA_NOT_AVAILABLE'?/Media unavailable/:/Preview unavailable/);
    assert.equal(f.w.document.querySelector('video, audio, img'),null);
    if(error!=='NETWORK_FAILURE'){
      for(const label of ['Mention in message','Add to timeline']) assert.equal(f.w.document.querySelector(`[aria-label="${label}"]`).disabled,true);
      const preview=f.w.document.querySelector('[aria-label="Preview Video 1"]');assert.equal(preview.draggable,false);
      await click(f,'Include in next message');assert.equal(f.w.detached,1,'A missing attachment remains removable.');
    } else assert.doesNotMatch(f.w.document.body.textContent,/Media deleted/);
    assert.equal(f.w.mutations,0);
  } finally {await f.close();}
});
