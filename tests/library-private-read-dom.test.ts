import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const original='https://storage.test/user-assets/owner/excerpt.mp4';
const access=original+'?signed=read';
const poster='https://storage.test/user-assets/owner/excerpt.webp?signed=poster';
const bundle=bundleClientFlow(`
 import React,{act} from 'react';import {createRoot} from 'react-dom/client';
 import {MediaActionPanel} from './components/library/MediaActionPanel.client';
 import {getBaseEngineIncludingHidden} from './src/lib/engines';
 import {AssetLibraryBrowser} from './components/library/AssetLibraryBrowser';
 import {AssetDropzone} from './components/AssetDropzone';
 import {normalizeAssetLibraryPayload,buildReferenceAssetFromLibraryAsset,buildComposerAttachments} from './app/(core)/(workspace)/app/_lib/workspace-assets';
 const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
 window.fx={act,render:()=>{const [asset]=normalizeAssetLibraryPayload({assets:[window.asset]},'all','video');const ref=buildReferenceAssetFromLibraryAsset({id:'video_url',type:'video'},asset);window.selected=ref;window.attachments=buildComposerAttachments({video_url:[ref]});root.render(window.browser?<AssetLibraryBrowser assets={[asset]} assetType="video" layout={window.layout||'modal'} title="Media" isLoading={false} source="all" availableSources={['all']} sourceLabels={{all:'All'}} onSourceChange={()=>{}} searchPlaceholder="Search" sourcesTitle="Sources" emptyLabel="Empty" emptySearchLabel="Empty" renderAssetActions={()=>null} selection={window.picker?{scope:'test',onToggle:selected=>window.chosen=selected}:undefined}/>:window.dropzone?<AssetDropzone engine={getBaseEngineIncludingHidden('luma-ray-3-2')} field={{id:'video_url',type:'video',maxCount:1}} required assets={[ref]} density={window.density}/>:<MediaActionPanel asset={asset} locale="en" onClose={()=>{}}/>);},unmount:()=>root.unmount()};
`,{'@/lib/i18n/I18nProvider':'export const useI18n=()=>({locale:"en",t:(_key,fallback)=>fallback});'});

test('private original is readable in inspector/download and both dropzones while selection keeps canonical source',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;
 w.asset={id:'excerpt',assetId:'ma_'+'a'.repeat(32),kind:'video',source:'upload',url:original,thumbUrl:'https://storage.test/user-assets/owner/excerpt.webp',accessUrl:access,thumbnailAccessUrl:poster,previewAccessUrl:access,durationSec:6};
 w.eval(await bundle);
 try{
  await w.fx.act(async()=>w.fx.render());
  assert.equal(w.document.querySelector('img').src,poster);
  await w.fx.act(async()=>w.document.querySelector('button[aria-label="Play video"]').click());
  assert.equal(w.document.querySelector('video').src,access);
  const download=w.document.querySelector('.app-media-panel-transport a').getAttribute('href');
  assert.equal(new URL(download,'https://app.test').searchParams.get('url'),access);
  assert.equal(w.document.querySelector('a[aria-label="Open original"]').href,access);
  for(const density of ['default','workspace']){
   w.dropzone=true;w.density=density;await w.fx.act(async()=>w.fx.render());
   assert.equal(w.document.querySelector('video').src,access);
   assert.equal(w.selected.url,original);assert.equal(w.attachments.video_url[0].url,original);
   assert.equal(w.selected.ref.assetId,'ma_'+'a'.repeat(32));
  }
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});


test('library card previews and reference-picker posters use read grants without selecting those grants',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;
 w.asset={id:'excerpt',kind:'video',source:'upload',url:original,thumbUrl:'https://storage.test/user-assets/owner/excerpt.webp',accessUrl:access,thumbnailAccessUrl:poster,previewUrl:original,previewAccessUrl:access,durationSec:6};
 w.browser=true;w.matchMedia=()=>({matches:false});w.eval(await bundle);
 try{
  await w.fx.act(async()=>w.fx.render());
  assert.equal(w.document.querySelector('img').src,poster);
  await w.fx.act(async()=>w.document.querySelector('.app-library-asset').dispatchEvent(new w.MouseEvent('mouseover',{bubbles:true})));
  assert.equal(w.document.querySelector('video').src,access);assert.equal(w.document.querySelector('video').poster,poster);
  await w.fx.act(async()=>w.document.querySelector('img').dispatchEvent(new w.Event('error')));
  assert.notEqual(w.document.querySelector('img').src,access,'video bytes never become an image fallback');
  w.picker=true;await w.fx.act(async()=>w.fx.render());
  assert.equal(w.document.querySelector('.app-picker-cover img').src,poster);
  await w.fx.act(async()=>w.document.querySelector('.app-picker-card').click());
  assert.equal(w.chosen.url,original);assert.equal(w.chosen.accessUrl,access);
  w.asset={...w.asset,thumbUrl:null,thumbnailAccessUrl:undefined};await w.fx.act(async()=>w.fx.render());
  assert.equal(w.document.querySelector('.app-picker-cover img'),null);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
