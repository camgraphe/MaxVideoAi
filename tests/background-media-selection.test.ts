import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const root = process.cwd(), frontend = path.join(root, 'frontend');
async function fixture(contents: string, stubs: Record<string,string> = {}) {
  const bundle = await build({ absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false, define: { 'process.env.NODE_ENV': '"test"' }, loader: { '.css': 'empty', '.module.css': 'empty' }, tsconfig: path.join(frontend, 'tsconfig.json'), plugins: [{ name: 'controlled-boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: stubs[a.path], loader: 'tsx', resolveDir: frontend }));
  } }], stdin: { loader: 'tsx', resolveDir: frontend, contents: `import React,{act,useState}from'react';import{createRoot}from'react-dom/client';window.IS_REACT_ACT_ENVIRONMENT=true;const noop=()=>{};${contents}` } });
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/app/tools/background-removal', runScripts: 'dangerously', pretendToBeVisual: true });
  const w: any = dom.window;
  w.MessageChannel = class { port1 = { onmessage(){} }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0) }; };
  w.fetch = () => { throw Error('Unmocked network forbidden'); };
  w.process = { env: {} };
  w.eval(bundle.outputFiles[0].text);
  return { w, doc: w.document, click: async (el: any) => { assert.ok(el); await w.fx.act(async () => el.click()); },
    input: async (el: any, value: string) => w.fx.act(async () => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(el, value); el.dispatchEvent(new w.Event('input',{bubbles:true})); }),
    render: async () => w.fx.act(async () => w.fx.render()), close: async () => { await w.fx.act(async () => w.fx.unmount()); w.close(); } };
}
const control = `const root=createRoot(document.getElementById('root'));window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};`;
const button = (f: any,text: string) => [...f.doc.querySelectorAll('button')].find(el => el.textContent.trim() === text);
async function referenceSearch() {
  const f = await fixture(`import{ReferenceLibraryPicker}from'./components/library/ReferenceLibraryPicker.client';window.loads=0;function App(){const[all,setAll]=useState(false);const assets=[{id:'recent',url:'https://example.invalid/recent.png',kind:'image'},...(all?[{id:'older',url:'https://example.invalid/older-target.png',kind:'image'}]:[])];return <ReferenceLibraryPicker locale="en" assets={assets} source="all" sourceLabels={{all:'All'}} availableSources={['all']} onSourceChange={noop} onClose={noop} title="References" emptyLabel="Empty" emptySearchLabel="No matching assets" isLoading={false} selection={{scope:'account:slot',onConfirm:noop}} hasMore={!all} onLoadMore={()=>{window.loads++;setAll(true)}}/>}${control}`);
  try {
    await f.render(); assert.ok(button(f,'Load more'));
    await f.input(f.doc.querySelector('input[type=search]'),'older-target');
    assert.match(f.doc.body.textContent,/No matching assets/);
    assert.ok(button(f,'Load more')); assert.equal(f.w.loads,0);
    await f.click(button(f,'Load more'));
    assert.equal(f.doc.querySelector('input[type=search]').value,'older-target');
    assert.equal(f.doc.querySelectorAll('.app-picker-card').length,1);
  } finally { await f.close(); }
}
const helpersPath = path.join(frontend,'src/components/tools/background-removal/_lib/background-removal-workspace-helpers.ts');
const commonStubs = {
  'next/link': `export default ({children,...props})=><a>{children}</a>;`,
  '@/components/HeaderBar': `export const HeaderBar=()=>null;`,
  '@/components/AppSidebar': `export const AppSidebar=()=>null;`,
  '@/components/library/ToolMediaHandoff.client': `export const ToolMediaHandoff=()=>null;`,
  '@/components/library/MediaDestinationActions.client': `export const MediaDestinationActions=()=>null;`,
  '@/hooks/useRequireAuth': `export const useRequireAuth=()=>({loading:false,user:window.actor});`,
  '@/lib/i18n/I18nProvider': `export const useI18n=()=>({locale:'en',t:(_key,fallback)=>fallback});`,
  '@/lib/api': `export const saveAssetToLibrary=()=>{throw Error('Save forbidden')};export const runBackgroundRemovalTool=()=>{throw Error('Paid generation forbidden')};`,
  '@/lib/authFetch': `export const authFetch=(url,options)=>window.fixtureFetch(url,options);`,
  './background-removal/_hooks/useBackgroundRemovalPricingPreview': `export const useBackgroundRemovalPricingPreview=()=>({pricePreview:{ready:true},priceLabel:'$0.10',priceHint:'',refreshQuote(){}});`,
  './background-removal/_hooks/useBackgroundRemovalRecentJobs': `export const useBackgroundRemovalRecentJobs=()=>({mutate(){},recentResults:window.recentResults});`,
  '../_lib/background-removal-workspace-helpers': `export * from ${JSON.stringify(helpersPath)};export async function readBackgroundRemovalVideoMetadata(){return {durationSec:5,width:640,height:360}};`,
};
const backgroundApp = `import App from './src/components/tools/BackgroundRemovalWorkspace';window.actor={id:'account-A'};window.recentResults=[];window.calls=[];window.uploadSignals=[];window.fixtureFetch=async(url,options)=>{window.calls.push(url);if(url==='/api/uploads/video'){window.uploadSignals.push(options.signal);return new Promise(resolve=>window.finishUpload=resolve);}if(url.startsWith('/api/media-library/assets'))return {ok:true,json:async()=>({ok:true,assets:[{id:'source-B',url:'https://example.invalid/source-B.mp4',name:'Library source B',kind:'video'}]})};throw Error('Unexpected request '+url)};${control}`;
async function openLibrary(f: any) { await f.click([...f.doc.querySelectorAll('button')].find(el=>el.textContent.includes('Choose from Media'))); }
async function backgroundRecent() {
  const f = await fixture(backgroundApp,commonStubs);
  try {
    await f.render(); await openLibrary(f); await f.click(button(f,'▷source-B'));
    assert.equal(f.doc.querySelector('video').getAttribute('src'),'https://example.invalid/source-B.mp4');
    f.w.recentResults=[{job:{jobId:'historic-A',status:'completed',settingsSnapshot:{source:{videoUrl:'https://example.invalid/source-A.mp4'}}},url:'https://example.invalid/result-A.webm',engineLabel:'Historical result A',mimeType:'video/webm',thumbUrl:'https://example.invalid/poster-A.jpg'}];
    await f.render(); await f.click(f.doc.querySelector('article button'));
    assert.equal(f.doc.querySelector('video').getAttribute('src'),'https://example.invalid/result-A.webm');
    const original=button(f,'Original'); assert.equal(original.disabled,true);
    assert.equal(f.doc.querySelector('input[type=url]').value,'');
    const source=f.doc.querySelector('video').getAttribute('src');
    assert.equal(source,'https://example.invalid/result-A.webm');
  } finally {await f.close();}
}
async function backgroundUpload() {
  const f=await fixture(backgroundApp,commonStubs);
  try {
    await f.render();await openLibrary(f);
    const input=f.doc.querySelector('input[type=file]');
    await f.w.fx.act(async()=>{Object.defineProperty(input,'files',{value:[new f.w.File(['synthetic'],'upload-A.mp4',{type:'video/mp4'})],configurable:true});input.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
    assert.equal(input.disabled,true);
    const libraryItem=button(f,'▷source-B');assert.equal(libraryItem.disabled,false);
    await f.click(libraryItem);assert.equal(f.w.uploadSignals[0]?.aborted,true);assert.equal(f.doc.querySelector('input[type=url]').value,'https://example.invalid/source-B.mp4');
    await f.w.fx.act(async()=>{f.w.finishUpload({ok:true,json:async()=>({ok:true,asset:{id:'upload-A',url:'https://example.invalid/upload-A.mp4',name:'Upload A'}})});});
    const actual=f.doc.querySelector('input[type=url]').value;
    assert.equal(actual,'https://example.invalid/source-B.mp4');
  }finally{await f.close();}
}

test('reference search can load later pages without clearing its query', referenceSearch);
test('background history never presents an unrelated current source as Original', backgroundRecent);
test('background source selection wins over a pending upload through the real controls', backgroundUpload);

test('background source ignores a superseded upload error and remains ready for a new upload', async () => {
  const f = await fixture(backgroundApp, commonStubs);
  try {
    await f.render(); await openLibrary(f);
    const input = f.doc.querySelector('input[type=file]');
    await f.w.fx.act(async () => {
      Object.defineProperty(input, 'files', { value: [new f.w.File(['fixture'], 'A.mp4', { type: 'video/mp4' })], configurable: true });
      input.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    });
    await f.click(button(f, '▷source-B'));
    await f.w.fx.act(async () => f.w.finishUpload({ ok: false, status: 500, json: async () => ({ error: 'Old upload failed' }) }));
    assert.equal(f.doc.querySelector('input[type=url]').value, 'https://example.invalid/source-B.mp4');
    assert.equal(input.disabled, false);
    assert.equal(f.doc.querySelector('[role=alert]'), null);
  } finally { await f.close(); }
});

test('background account change aborts an upload and hides its late result from the next account', async () => {
  const f = await fixture(backgroundApp, commonStubs);
  try {
    await f.render();
    const input = f.doc.querySelector('input[type=file]');
    await f.w.fx.act(async () => {
      Object.defineProperty(input, 'files', { value: [new f.w.File(['fixture'], 'A.mp4', { type: 'video/mp4' })], configurable: true });
      input.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    });
    f.w.actor = { id: 'account-B' };
    await f.render();
    assert.equal(f.w.uploadSignals[0]?.aborted, true);
    await f.w.fx.act(async () => f.w.finishUpload({ ok: true, json: async () => ({ ok: true, asset: { id: 'private-A', url: 'https://example.invalid/private-A.mp4' } }) }));
    assert.equal(f.doc.querySelector('input[type=url]').value, '');
    assert.equal(f.doc.querySelector('video'), null);
    assert.equal(f.doc.querySelector('input[type=file]').disabled, false);
  } finally { await f.close(); }
});
