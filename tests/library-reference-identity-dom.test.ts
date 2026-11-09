import {installMediaGridGeometry} from './helpers/media-grid-dom';
import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const assetId = `ma_${'a'.repeat(32)}`;
const asset = {
  organization:{key:'org-internal',favorite:false,trashedAt:null,collectionIds:[]},libraryRef:{type:'asset',assetId,kind:'audio'},sourceRevision:'revision',
  id: 'url:internal-row', assetId, ref: { type: 'asset', assetId, kind: 'audio' },
  name: 'voice.wav', kind: 'audio', source: 'upload', mime: 'audio/wav',
  url: 'https://private.invalid/voice.wav?original=exact', durationSec: 12.5,
  mediaFacts: { source: 'probe', durationSec: 12.5, hasAudio: true },
  accessUrl: 'https://private.invalid/grant?token=read', thumbnailAccessUrl: 'https://private.invalid/thumb-grant',
  previewAccessUrl: 'https://private.invalid/preview-grant', playbackAccessUrl: 'https://private.invalid/playback-grant',
};
const adapters = {
  'next/navigation': `export const usePathname=()=>'/app/library';export const useRouter=()=>({replace(){},push:path=>window.paths.push(path)});export const useSearchParams=()=>new URLSearchParams();`,
  '@/lib/owned-auth-fetch': 'export const ownedAuthFetch=(url,_owner,init)=>window.fetch(url,init);',
  '@/lib/authFetch': 'export const authFetch=(url)=>window.fetch(url);',
  '@/lib/client-video-upload': 'export const uploadVideoFile=async()=>{throw Error("Unexpected upload");};',
  '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:"en",t:(_key,fallback)=>fallback});',
};
async function mount(contents: string, rows: unknown[]) {
  const bundle = await bundleClientFlow(`
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';${contents}
    const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
    window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};
  `, adapters);
  const dom=createClientFlowDom('/app/library'), w=dom.window as any;
  installMediaGridGeometry(w);w.paths=[];w.fetch=async(url,init)=>url.includes('/selection/validate')?Response.json({ok:true,results:JSON.parse(init.body).candidates.map(c=>({reference:c.reference}))}):Response.json({ok:true,assets:rows,nextCursor:null,hasMore:false});w.eval(bundle);
  await w.fx.act(async()=>w.fx.render());
  return { w, close:async()=>{await w.fx.act(async()=>w.fx.unmount());dom.window.close();} };
}
async function settle(w:any,predicate:()=>boolean) {
  for(let i=0;i<100;i++){if(predicate())return;await w.fx.act(async()=>new Promise(resolve=>setTimeout(resolve,5)));}
  assert.fail('Actual owner did not settle');
}

test('saved Media carries public identity, measured audio facts and separate original/read grants into creator handoff',async()=>{
  const f=await mount(`
    import {SWRConfig} from 'swr';import {useLibraryPageData} from './app/(core)/(workspace)/app/library/_hooks/useLibraryPageData';
    import {MediaDestinationActions} from './components/library/MediaDestinationActions.client';
    function Owner(){const data=useLibraryPageData({userId:'owner',activeView:'saved',activeKind:'audio',activeSource:'all',toolsEnabled:true});window.data=data;return data.currentAssets.map(asset=><MediaDestinationActions key={asset.id} asset={asset} userId="owner" locale="en"/>)}
    const cache=new Map();function App(){return <SWRConfig value={{provider:()=>cache,revalidateOnFocus:false}}><Owner/></SWRConfig>}
  `,[asset]);
  try {
    await settle(f.w,()=>f.w.data.currentAssets.length===1);
    const projected=JSON.parse(JSON.stringify(f.w.data.currentAssets[0]));
    for(const key of ['id','assetId','ref','durationSec','mediaFacts','url','accessUrl','thumbnailAccessUrl','previewAccessUrl','playbackAccessUrl','source'] as const) assert.deepEqual(projected[key],asset[key],key);
    const target=Array.from(f.w.document.querySelectorAll('button')).find((b:any)=>b.textContent==='Subtitles') as HTMLButtonElement;
    assert.ok(target,'released audio creator destination');await f.w.fx.act(async()=>target.click());
    const handoff=JSON.parse(f.w.sessionStorage.getItem('maxvideoai:media-handoff:v1'));
    assert.equal(handoff.destination,'subtitles');assert.equal(handoff.account,'owner');
    assert.deepEqual(handoff.asset.ref,{type:'asset',assetId,kind:'audio'});
    assert.equal(handoff.asset.id,'url:internal-row');assert.equal(handoff.asset.url,asset.url);
    assert.deepEqual(handoff.asset.mediaFacts,asset.mediaFacts);assert.equal(handoff.asset.durationSec,12.5);
  }finally{await f.close();}
});

const image={...asset,kind:'image',mime:'image/png',name:'owned.png',ref:{type:'asset',assetId,kind:'image'}};
for(const [label,row,allowed,expected] of [
  ['internal mutation id with public identity',image,true,{type:'asset',assetId,kind:'image'}],
  ['canonical internal id control',{...image,id:assetId,assetId:undefined,ref:undefined},true,{type:'asset',assetId,kind:'image'}],
  ['ref-only canonical identity',{...image,assetId:undefined},true,{type:'asset',assetId,kind:'image'}],
  ['exact job output',{...image,assetId:undefined,ref:undefined,jobId:'job-owned',sourceOutputId:'output-exact'},true,{type:'job-output',jobId:'job-owned',outputId:'output-exact',kind:'image'}],
  ['mismatched ref kind',{...image,ref:{type:'asset',assetId,kind:'video'}},false,null],
  ['conflicting public ids',{...image,ref:{type:'asset',assetId:`ma_${'b'.repeat(32)}`,kind:'image'}},false,null],
  ['malformed ref',{...image,ref:{type:'asset',assetId:'invented',kind:'image'}},false,null],
  ['missing canonical identity',{...image,assetId:undefined,ref:undefined},false,null],
] as const) test(`creator picker validates ${label} without substituting its mutation id`,async()=>{
  const f=await mount(`import {CreatorSourcePicker} from './src/components/tools/creator/CreatorSourcePicker.client';function App(){return <CreatorSourcePicker userId="owner" locale="en" label="Source" kind="image" source={null} onChange={value=>window.selected=value}/>}`,[row]);
  try {
    await f.w.fx.act(async()=>Array.from(f.w.document.querySelectorAll('button')).find((b:any)=>b.textContent==='Choose from Media')!.click());
    await settle(f.w,()=>Boolean(f.w.document.querySelector('.compact-media-check input')));
    const card=f.w.document.querySelector('.compact-media-check input');assert.equal(card.disabled,!allowed);
    if(allowed){await f.w.fx.act(async()=>card.click());await f.w.fx.act(async()=>f.w.document.querySelector('.app-picker-use').click());assert.deepEqual(JSON.parse(JSON.stringify(f.w.selected.ref)),expected);assert.equal(f.w.selected.url,asset.url);assert.equal(row.id,label==='canonical internal id control'?assetId:'url:internal-row');}
  }finally{await f.close();}
});
