import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {buildWorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import {stripStudioMediaAccess} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-media-access';
import {useConversationTimeline} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationTimeline';

const base='https://conversation-thumbnails-fixture.s3.us-east-1.amazonaws.com';
Object.assign(process.env,{S3_BUCKET:'conversation-thumbnails-fixture',S3_REGION:'us-east-1',S3_PUBLIC_BASE_URL:base,S3_ACCESS_KEY_ID:'fixture-key',S3_SECRET_ACCESS_KEY:'fixture-secret'});
const clip=(kind: 'image'|'video',id=kind): WorkspaceTimelineItem => ({id,outputNodeId:id,title:id,track:'video',mediaKind:kind,startSec:0,durationSec:3,mediaUrl:`${base}/renders/owner/${kind}.${kind==='image'?'png':'mp4'}`,thumbnailUrl:`${base}/renders/thumbs/owner/${kind}.jpg`,ref:{type:'asset',assetId:'ma_'+'1'.repeat(32),kind},mediaAccessRequired:true,status:'completed'});

async function timelineMarkup(items: WorkspaceTimelineItem[]) {
  const frontend=resolve('frontend');
  const stubs: Record<string,string>={
    '../conversation-timeline.module.css':'export default {};',
    'next/navigation':'export const useRouter=()=>({push(){}});',
    '@/lib/i18n/I18nProvider':'export const useI18n=()=>({dictionary:{},locale:"en"});',
    '../../../_lib/studio-copy':'export const resolveStudioCopy=()=>({notices:{},viewer:{monitor:{}}});',
    '../_hooks/useConversationTimeline':'export const useConversationTimeline=()=>({view:{data:{revision:1},items:fixture.items,settings:{fps:30,aspectRatio:"16:9",resolution:"720p"}},busy:false,edit(){}});',
    '../../../workspace/_hooks/useWorkspaceTimelinePlayback':'export const useWorkspaceTimelinePlayback=()=>({playheadSec:0,isTimelinePlaying:false,stopTimelinePlayback(){}});',
    '../../../workspace/_components/viewer/useProgramPlaybackSync':'export const useProgramPlaybackSync=()=>({});',
    '../../../workspace/_components/viewer/ProgramPlaybackLayers':'export const ProgramPlaybackLayers=()=>null;',
    './ConversationExport.client':'export const ConversationExport=()=>null;',
  };
  const bundled=await build({absWorkingDir:frontend,stdin:{contents:"export {ConversationTimeline} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ConversationTimeline.client';",resolveDir:frontend,loader:'ts'},tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',loader:{'.css':'empty'},jsx:'automatic',plugins:[{name:'timeline-fixture',setup(builder){builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js'}));}}]});
  const module={exports:{} as any};
  runInNewContext(bundled.outputFiles[0].text,{module,exports:module.exports,fixture:{items},require:createRequire(resolve(frontend,'package.json')),React,console});
  return renderToStaticMarkup(React.createElement(module.exports.ConversationTimeline,{projectId:'fixture',projectName:'Film',refreshKey:0,onOpenLibrary(){},onExportChange(){}}));
}

test('real conversation timeline renders separately signed image and video thumbnails, retaining canonical edit state',async()=>{
  const {buildConversationPreviewMedia}=await import('../frontend/src/server/studio/conversation-preview-media');
  const input=[clip('image'),clip('video')];const before=JSON.stringify(input);const signed:string[]=[];
  const preview=await buildConversationPreviewMedia('owner',input,{resolve:async(userId,ref)=>{
    assert.equal(userId,'owner');const source=input.find(item=>item.mediaKind===ref.kind)!;
    return {kind:ref.kind,url:source.mediaUrl!,thumbUrl:source.thumbnailUrl,originalAccess:{type:'owned-storage',storageKey:`renders/owner/${ref.kind}.${ref.kind==='image'?'png':'mp4'}`}} as any;
  },sign:async(key,options)=>{signed.push(key);assert.equal(options.expiresInSeconds,300);return 'https://signed.test/'+key+'?grant=read';}});
  const html=await timelineMarkup(preview);
  const sources=Array.from(html.matchAll(/<img\b[^>]*src="([^"]+)"/g),match=>match[1]);
  assert.deepEqual(sources,['https://signed.test/renders/thumbs/owner/image.jpg?grant=read','https://signed.test/renders/thumbs/owner/video.jpg?grant=read']);
  assert.equal(signed.length,4,'Originals and thumbnails each receive their own exact-key grant.');
  assert.equal(JSON.stringify(input),before,'Read projections never overwrite canonical timeline URLs.');
  assert.deepEqual(preview.map(item=>item.mediaUrl),input.map(item=>item.mediaUrl));
  assert.deepEqual(preview.map(item=>item.thumbnailUrl),input.map(item=>item.thumbnailUrl));
  const manifest=buildWorkspaceTimelineRenderManifest({items:preview,nodes:[],projectName:'Film',sequenceId:'main',sequenceName:'Main'});
  assert.doesNotMatch(JSON.stringify(manifest),/signed\.test|grant=read|thumbnailAccessUrl/,'The real conversation export builder cannot carry the preview grant.');
  assert.doesNotMatch(JSON.stringify(stripStudioMediaAccess({timelineItems:preview})),/signed\.test|grant=read|thumbnailAccessUrl/,'Workspace persistence strips all transient thumbnail access.');
});

test('thumbnail access never signs a foreign owner and missing thumbnails never turn video into an image',async()=>{
  const {buildConversationPreviewMedia}=await import('../frontend/src/server/studio/conversation-preview-media');
  const signed:string[]=[];
  const input=[clip('image'),clip('video')];
  const preview=await buildConversationPreviewMedia('owner',input,{resolve:async(_owner,ref)=>({kind:ref.kind,url:`${base}/renders/owner/${ref.kind}`,thumbUrl:`${base}/renders/thumbs/other/${ref.kind}.jpg`,originalAccess:{type:'owned-storage',storageKey:`renders/owner/${ref.kind}`}} as any),sign:async key=>{signed.push(key);return 'https://signed.test/'+key;}});
  assert.deepEqual(signed.sort(),['renders/owner/image','renders/owner/video']);
  assert.equal(preview[0].thumbnailAccessUrl,preview[0].mediaAccessUrl,'An image may use its readable original when its thumbnail is unavailable.');
  assert.equal(preview[1].thumbnailAccessUrl,undefined,'A video keeps its title, never an img pointed at MP4 bytes.');
  assert.ok(preview.every(item=>item.mediaAccessUrl && !item.mediaAccessError),'Thumbnail failure does not make the original unavailable.');
  assert.doesNotMatch(JSON.stringify(preview),/renders\/thumbs\/other/);
});

test('preview uses the resolved thumbnail rather than stale clip metadata and shares grants across duplicate references',async()=>{
  const {buildConversationPreviewMedia}=await import('../frontend/src/server/studio/conversation-preview-media');
  const source=clip('video');let resolutions=0;const signed:string[]=[];
  const preview=await buildConversationPreviewMedia('owner',[source,{...source,id:'duplicate'}],{resolve:async()=>{resolutions++;return {kind:'video',url:source.mediaUrl,thumbUrl:'https://cdn.maxvideoai.com/current-thumbnail.jpg',originalAccess:{type:'owned-storage',storageKey:'renders/owner/video.mp4'}} as any;},sign:async key=>{signed.push(key);return 'https://signed.test/'+key;}});
  assert.equal(resolutions,1);assert.deepEqual(signed,['renders/owner/video.mp4']);
  assert.ok(preview.every(item=>item.thumbnailAccessUrl==='https://cdn.maxvideoai.com/current-thumbnail.jpg'));
});

test('the actual conversation edit hook submits only its command, never preview thumbnail grants',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://maxvideoai.com'});
  const previous=new Map(['window','document','navigator','fetch','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const posts:Record<string,unknown>[]=[];let rejectEdit=false;
  const preview={...clip('video'),thumbnailAccessUrl:'https://signed.test/thumbnail.jpg?grant=read',mediaAccessUrl:'https://signed.test/video.mp4?grant=read'};
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(_url:unknown,options?:RequestInit)=>{
    if(options?.method==='POST') {posts.push(JSON.parse(String(options.body)));if(rejectEdit)return Response.json({ok:false,error:'TIMELINE_REVISION_CONFLICT'},{status:409});}
    return new Response(JSON.stringify({ok:true,result:{data:{sequenceId:'main',revision:7},settings:{fps:30,aspectRatio:'16:9',resolution:'720p'},items:[preview]}}));
  }})) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  const root=createRoot(dom.window.document.getElementById('root')!);let state:ReturnType<typeof useConversationTimeline>;
  function Harness(){state=useConversationTimeline('fixture',0);return null;}
  try {
    await act(async()=>root.render(React.createElement(Harness)));
    assert.equal(state!.view?.items[0].thumbnailAccessUrl,preview.thumbnailAccessUrl);
    const edit={kind:'trim' as const,clipId:'video',edge:'end' as const,durationFrames:60};
    await act(async()=>{await state!.edit(edit);});
    assert.equal(posts.length,1);assert.deepEqual(posts[0].edit,edit);
    assert.deepEqual(Object.keys(posts[0]).sort(),['edit','expectedRevision','idempotencyKey','sequenceId']);
    assert.doesNotMatch(JSON.stringify(posts),/signed\.test|grant=read|thumbnailAccessUrl/);
    rejectEdit=true;await act(async()=>{await state!.edit(edit);});
    assert.equal(state!.error,'TIMELINE_REVISION_CONFLICT','the automatic successful read cannot erase a rejected edit');
    await act(async()=>{await state!.refresh();});assert.equal(state!.error,'TIMELINE_REVISION_CONFLICT');
    rejectEdit=false;await act(async()=>{await state!.edit(edit);});assert.equal(state!.error,null);
  } finally {
    await act(async()=>root.unmount());dom.window.close();
    for(const [key,descriptor] of previous){if(descriptor) Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});
