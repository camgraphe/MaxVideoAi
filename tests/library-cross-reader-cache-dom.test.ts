import {installMediaGridGeometry} from './helpers/media-grid-dom';
import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';
const bundle=bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {SWRProvider} from './components/swr/SWRProvider';
import {useLibraryPageData} from './app/(core)/(workspace)/app/library/_hooks/useLibraryPageData';
import {useLibraryAssetMutations} from './app/(core)/(workspace)/app/library/_hooks/useLibraryAssetMutations';
import {useWorkspaceAssetLibrary} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary';
import {DEFAULT_LIBRARY_COPY} from './app/(core)/(workspace)/app/library/_lib/library-page-helpers';
function Reader({index}){const data=useLibraryPageData({userId:window.owner,activeView:window.view,activeKind:'image',activeSource:window.sources[index],toolsEnabled:true});window.readers[index]=data;
const mutation=useLibraryAssetMutations({userId:window.owner,activeKind:'image',activeSource:'all',copy:DEFAULT_LIBRARY_COPY,mutateAssets:data.mutateAssets,mutateRecentOutputs:data.mutateRecentOutputs,setActiveSource(){},setActiveView(){}});if(index===0)window.mutation=mutation;
return <output data-reader={index}>{data.currentAssets.map(a=>a.id).join(',')}</output>}
function Manual(){const data=useWorkspaceAssetLibrary({userId:window.owner,showNotice(){},setInputAssets(){window.draftChanges++}});window.manual=data;return <output data-manual>{data.visibleAssetLibrary.map(a=>a.id).join(',')}</output>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<SWRProvider><Reader index={0}/><Reader index={1}/><Manual/></SWRProvider>),unmount:()=>root.unmount()};
`,{'next/navigation':`export const usePathname=()=>'/app/library';export const useRouter=()=>({replace(){}});export const useSearchParams=()=>new URLSearchParams();`,
'@/lib/supabaseClient':'export const supabase={auth:{getSession:()=>window.getSession()}};',
'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});'});

test('confirmed saved deletion fences two real Infinite readers, visited pages and the manual reader without removing recent history',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;Object.assign(w,{owner:'A',view:'saved',sources:['all','upload'],readers:[],draftChanges:0});
 w.sessionStorage.setItem('last-known:user-id','A');w.getSession=async()=>({data:{session:{user:{id:w.owner},access_token:'token-'+w.owner}},error:null});
 let deleted=false,fail=false,hold=false;const late=deferred<any>();let held=false,visited=false;
 const row=(id:string)=>({id,organization:{key:id,favorite:false,trashedAt:null,collectionIds:[]},libraryRef:{type:'asset',assetId:'ma_'+id,kind:'image'},sourceRevision:'revision',url:'https://example.invalid/'+id+'.png',kind:'image',source:'upload'});
 const response=(url:string)=>({ok:true,status:200,json:async()=>({ok:true,assets:url.includes('view=review')?[{...row('output-A'),jobId:'job',isSaved:!deleted}]:deleted?[]:[row('saved-A')],outputs:[{...row('output-A'),jobId:'job',isSaved:!deleted}],nextCursor:null,hasMore:false})});
 w.fetch=async(url:string,init:RequestInit={})=>{if(url.includes('q=visited'))visited=true;if(init.method==='DELETE'){if(fail)return {ok:false,json:async()=>({ok:false,error:'DENIED'})};deleted=true;return {ok:true,json:async()=>({ok:true})};}if(hold&&!held&&url.includes('q=old')){held=true;return late.promise;}return response(url);};
 w.eval(await bundle);
 const settle=async(p:()=>boolean,label:string)=>{for(let n=0;n<120;n++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label);};
 const output=(n:number)=>w.document.querySelector('[data-reader="'+n+'"]').textContent;
 try{
 await w.fx.act(async()=>w.fx.render());await settle(()=>output(0)==='saved-A'&&output(1)==='saved-A','initial two readers');
 await w.fx.act(async()=>w.manual.setAssetPickerTarget({kind:'field',field:{id:'image',type:'image'}}));await settle(()=>w.document.querySelector('[data-manual]').textContent==='saved-A','manual initial');
 await w.fx.act(async()=>w.readers[1].setSearchQuery('visited'));await settle(()=>visited&&output(1)==='saved-A','visited search page');
 fail=true;await w.fx.act(async()=>w.mutation.handleDeleteAsset('saved-A'));assert.equal(output(0),'saved-A');assert.equal(output(1),'saved-A');assert.equal(w.mutation.deleteError,'DENIED');fail=false;
 hold=true;await w.fx.act(async()=>w.readers[1].setSearchQuery('old'));await settle(()=>held,'pending search started');
 await w.fx.act(async()=>w.mutation.handleDeleteAsset('saved-A'));
 await w.fx.act(async()=>late.resolve({ok:true,status:200,json:async()=>({ok:true,assets:[row('saved-A')],nextCursor:null,hasMore:false})}));hold=false;
 await settle(()=>output(1)==='', 'pending search cannot resurrect its old row');
 await w.fx.act(async()=>w.readers[1].setSearchQuery('visited'));await settle(()=>output(1)==='', 'visited search cache is retired');
 await w.fx.act(async()=>w.readers[1].setSearchQuery(''));
 await settle(()=>output(0)===''&&output(1)===''&&w.document.querySelector('[data-manual]').textContent==='','all cached and manual projections retire confirmed deleted rows');
 assert.equal(w.draftChanges,0);
 await w.fx.act(async()=>{w.view='review';w.fx.render()});await settle(()=>output(0)==='output-A','physical saved deletion preserves recent output');
 await w.fx.act(async()=>{w.owner='B';w.sessionStorage.setItem('last-known:user-id','B');w.fx.render()});assert.ok(!output(0).includes('saved-A'));
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

const organizationBundle=bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {SWRProvider} from './components/swr/SWRProvider';
import {useLibraryBrowse} from './hooks/useLibraryBrowse';import {useImageLibraryData} from './app/(core)/(workspace)/app/image/_hooks/useImageLibraryData';import {mutateLibraryOrganization} from './lib/library-mutations';
function Reader(){window.common=useLibraryBrowse({userId:window.owner,scope:{view:'all',kind:'image',sort:'recent',q:window.q}});window.compat=useImageLibraryData({userId:window.owner,source:'all',isCharacterMode:false});return <><output data-common>{window.common.assets.map(a=>a.id+':'+a.organization.favorite).join(',')}</output><output data-compat>{window.compat.data?.map(a=>a.id).join(',')}</output></>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<SWRProvider><Reader/></SWRProvider>),mutate:request=>mutateLibraryOrganization(window.owner,request),unmount:()=>root.unmount()};
`,{'next/navigation':`export const usePathname=()=>'/app/library';`,
'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});'});
test('Favorite retains visited pages, partial Trash refreshes mirrors, failures are truthful and real owner/filter changes reset size',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;Object.assign(w,{owner:'A',q:''});let favorite=false,trashed=false,fail=false;const requests:string[]=[];
 w.getSession=async()=>({data:{session:{user:{id:w.owner},access_token:'token-'+w.owner}},error:null});
 w.fetch=async(url:string,init:RequestInit={})=>{
 if(init.method==='POST'){if(fail)return {ok:false,json:async()=>({ok:false,succeededCount:0,failedCount:2,results:[{status:'failed',error:'DENIED'}]})};const operation=JSON.parse(init.body as string).operation;favorite=operation==='favorite';trashed=operation==='trash';return {ok:true,json:async()=>({ok:true,succeededCount:1,failedCount:1,succeededKeys:['lo_first'],failed:[{key:'lo_missing',errorCode:'SOURCE_UNAVAILABLE'}]})};}
 requests.push(w.owner+':'+url);const u=new URL(url,'https://app.test'),page=u.searchParams.get('cursor')?'second':'first',common=u.pathname.endsWith('/browse');const id=common?page:'mirror-'+page;
 const assets=trashed&&page==='first'?[]:[{id,url:'https://example.invalid/'+id+'.png',kind:'image',organization:{key:'lo_'+page,favorite},libraryRef:{type:'asset',assetId:'ma_'+page,kind:'image'}}];
 return {ok:true,json:async()=>({ok:true,assets,nextCursor:page==='first'?'page2':null,hasMore:page==='first',totalCount:trashed?1:2})};};
 w.eval(await organizationBundle);const settle=async(p:()=>boolean,label:string)=>{for(let i=0;i<100;i++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label)};
 try{
 await w.fx.act(async()=>w.fx.render());await settle(()=>w.common.assets.length===1&&w.compat.data?.length===1,'initial');
 await w.fx.act(async()=>{w.common.loadMore();w.compat.loadMore()});await settle(()=>w.common.assets.length===2&&w.compat.data?.length===2,'two loaded pages');
 const result=await w.fx.act(async()=>w.fx.mutate({operation:'favorite',snapshotId:'ls_fixture'}));
 assert.equal(result.failedCount,1);await settle(()=>w.common.assets.length===2&&w.common.assets.every((a:any)=>a.organization.favorite),'favorite retains both visited pages');
 assert.equal(w.compat.data.length,2);
 fail=true;const failure=await w.fx.act(async()=>w.fx.mutate({operation:'trash',snapshotId:'ls_fixture'}));assert.equal(failure.ok,false);assert.equal(w.common.assets.length,2);fail=false;
 await w.fx.act(async()=>w.fx.mutate({operation:'trash',snapshotId:'ls_fixture'}));await settle(()=>w.common.assets.length===1&&w.compat.data?.length===1,'partial trash refreshes both readers');assert.equal(w.compat.data[0].id,'mirror-second');
 await w.fx.act(async()=>{w.owner='B';trashed=false;w.fx.render()});await settle(()=>w.common.assets.length===1,'new owner initial page');assert.equal(requests.filter(r=>r.startsWith('B:')&&r.includes('cursor=')).length,0,'new owner does not inherit page count');
 await w.fx.act(async()=>{w.common.loadMore()});await settle(()=>w.common.assets.length===2,'B two pages');
 await w.fx.act(async()=>{w.q='new-filter';w.fx.render()});await settle(()=>w.common.assets.length===1,'filter resets pages');assert.equal(requests.filter(r=>r.includes('q=new-filter')&&r.includes('cursor=')).length,0);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('a confirmed mutation completing after account retirement refreshes only its initiating account',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;Object.assign(w,{owner:'A',q:''});const pending=deferred<any>();const requests:string[]=[];let changed=false;
 w.getSession=async()=>({data:{session:{user:{id:w.owner},access_token:'token-'+w.owner}},error:null});
 w.fetch=async(url:string,init:RequestInit={})=>{const owner=new Headers(init.headers).get('Authorization')?.endsWith('token-B')?'B':'A';requests.push(owner+':'+(init.method??'GET'));if(init.method==='POST')return pending.promise;return {ok:true,json:async()=>({ok:true,assets:[{id:owner,url:'https://example.invalid/'+owner+'.png',kind:'image',organization:{key:'lo_'+owner,favorite:owner==='A'&&changed}}],nextCursor:null,hasMore:false,totalCount:1})};};
 w.eval(await organizationBundle);const settle=async(p:()=>boolean,label:string)=>{for(let i=0;i<100;i++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label)};
 try{
 await w.fx.act(async()=>w.fx.render());await settle(()=>w.common.assets[0]?.id==='A','A initial');let mutation:Promise<any>;
 await w.fx.act(async()=>{mutation=w.fx.mutate({operation:'favorite',snapshotId:'ls_fixture'})});await settle(()=>requests.includes('A:POST'),'A mutation in flight');
 await w.fx.act(async()=>{w.owner='B';w.fx.render()});await settle(()=>w.common.assets[0]?.id==='B'&&w.compat.data?.[0]?.id==='B','B initial');const bReads=requests.filter(r=>r==='B:GET').length;
 changed=true;await w.fx.act(async()=>{pending.resolve({ok:true,json:async()=>({ok:true,succeededCount:1,failedCount:0,succeededKeys:['lo_A'],failed:[]})});await mutation!});
 assert.equal(w.common.assets[0].id,'B');assert.equal(requests.filter(r=>r==='B:GET').length,bReads,'A completion does not revalidate B');
 await w.fx.act(async()=>{w.owner='A';w.fx.render()});await settle(()=>w.common.assets[0]?.organization.favorite===true,'A retired cache is not reused');
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

const writerBundle=bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {SWRProvider} from './components/swr/SWRProvider';
import {useLibraryBrowse} from './hooks/useLibraryBrowse';import {CreatorSourcePicker} from './src/components/tools/creator/CreatorSourcePicker.client';import {ImageReferenceLibrary} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageReferenceLibrary.client';
function Scene(){window.reader=useLibraryBrowse({userId:window.owner,scope:{view:'all',kind:'image',sort:'recent'}});return <><output>{window.reader.assets.map(a=>a.id).join(',')}</output>{window.writer==='creator'?<CreatorSourcePicker userId={window.owner} locale="en" label="Source" kind="image" source={null} onChange={asset=>window.selected.push(asset)}/>:<ImageReferenceLibrary accountKey={window.owner} purpose={window.purpose} onClose={()=>{}} onSelect={asset=>window.selected.push(asset)}/>}</>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<SWRProvider><Scene/></SWRProvider>),unmount:()=>root.unmount()};
`,{'next/navigation':`export const usePathname=()=>'/app/library';`,'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});'});
for(const writer of ['creator','studio-save','studio-upload'])for(const outcome of ['success','late','denied','lookup-failed','lookup-retry','lookup-retry-denied','lookup-context','lookup-filter'].filter(value=>!value.startsWith('lookup-')||writer==='studio-save'))test(`${writer} write coherence: ${outcome}`,async()=>{
 const late=outcome==='late',denied=outcome==='denied';
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;Object.assign(w,{owner:'A',writer,selected:[]});installMediaGridGeometry(w);w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.getSession=async()=>({data:{session:{user:{id:w.owner},access_token:'token-'+w.owner}},error:null});const pending=deferred<any>();let writes=0,changed=false,lookups=0;const reads:string[]=[];
 const asset=(owner:string)=>({id:owner+(changed?'-new':'-old'),assetId:'ma_'+'a'.repeat(32),url:'https://example.invalid/'+owner+'.png',kind:'image',organization:{key:'lo_'+owner}});
 w.fetch=async(url:string,init:RequestInit={})=>{const owner=new Headers(init.headers).get('Authorization')?.replace('Bearer token-','')??w.owner;
 if(url.includes('/selection/validate'))return {ok:true,json:async()=>({ok:true,results:JSON.parse(init.body as string).candidates.map((candidate:any)=>({reference:candidate.reference}))})};if(url.endsWith('/organization'))return {ok:true,json:async()=>({ok:true,succeededCount:1,failedCount:0})};
 if(init.method==='POST'){writes++;if(outcome==='lookup-retry-denied'&&writes===2)return {ok:false,json:async()=>({ok:false})};return pending.promise;}if(url.includes('/browse'))reads.push(owner);if(url.includes('originUrl=')&&outcome.startsWith('lookup-')&&++lookups<=(outcome==='lookup-retry-denied'?2:1))return {ok:false,json:async()=>({ok:false})};
 if(url.includes('recent-outputs'))return {ok:true,json:async()=>({ok:true,outputs:[{id:'out',jobId:'job',url:'https://example.invalid/recent.png',status:'ready'}]})};
 return {ok:true,json:async()=>({ok:true,assets:[asset(owner)],nextCursor:null,hasMore:false,totalCount:1})};};w.eval(await writerBundle);
 const settle=async(p:()=>boolean,label:string)=>{for(let n=0;n<160;n++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label)};
 const source=async(value:string)=>w.fx.act(async()=>{const select=w.document.querySelector('select');select.value=value;select.dispatchEvent(new w.Event('change',{bubbles:true}));});
 const button=(text:string)=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent===text) as any;
 try{await w.fx.act(async()=>w.fx.render());await settle(()=>w.reader.assets[0]?.id==='A-old','mounted Infinite A');
 if(writer==='studio-save'){
 await source('recent');await settle(()=>!!w.document.querySelector('.compact-media-check input'),'recent selection available');
 await w.fx.act(async()=>w.document.querySelector('.compact-media-check input').click());await w.fx.act(async()=>button('Add to conversation').click());
 }else{const input=w.document.querySelector('input[type=file]');Object.defineProperty(input,'files',{configurable:true,value:[new w.File(['image'],'fixture.png',{type:'image/png'})]});await w.fx.act(async()=>input.dispatchEvent(new w.Event('change',{bubbles:true})));if(writer==='studio-upload')await w.fx.act(async()=>w.document.querySelector('.app-library-import button').click());}
 await settle(()=>writes===1,'write starts');if(late){await w.fx.act(async()=>{w.owner='B';w.fx.render()});await settle(()=>w.reader.assets[0]?.id==='B-old','mounted Infinite B');}
 const bReads=reads.filter(x=>x==='B').length,aReads=reads.filter(x=>x==='A').length;changed=!denied;await w.fx.act(async()=>pending.resolve({ok:!denied,json:async()=>({ok:!denied,asset:denied?undefined:asset('A')})}));
 if(denied){assert.equal(w.reader.assets[0].id,'A-old');assert.equal(w.selected.length,0);assert.equal(reads.filter(x=>x==='A').length,aReads,'failed write does not publish');assert.ok(writer==='studio-upload'?w.document.querySelector('.app-library-import')?.textContent.includes('Failed'):w.document.querySelector('[role=alert]'));return;}
 if(late){await w.fx.act(async()=>new Promise(r=>setTimeout(r,30)));assert.equal(w.selected.length,0,'late A cannot insert into B');assert.equal(reads.filter(x=>x==='B').length,bReads,'A write never invalidates B');assert.ok(!w.document.querySelector('[role=alert]'),'late A must not publish its failure into B');await w.fx.act(async()=>{w.owner='A';w.fx.render()});}
 await settle(()=>w.reader.assets[0]?.id==='A-new','confirmed write retires saved cache');if(writer==='studio-upload'&&!late){assert.equal(w.selected.length,0);await settle(()=>!!button('Choose · fixture.png'),'completed import');await w.fx.act(async()=>button('Choose · fixture.png').click());await w.fx.act(async()=>button('Add to conversation').click());}if(!late)assert.equal(w.selected.length,outcome.startsWith('lookup-')?0:1,'insertion survives own invalidation only with a resolved canonical ref');
 if(writer!=='creator')await settle(()=>!!w.document.querySelector('.compact-media-check input'),'replacement picker fully settles');
 if(late)assert.ok(!w.document.querySelector('[role=alert]'),'retired A failure cannot appear after owner retirement');
 if(outcome.startsWith('lookup-')){
 const alert=w.document.querySelector('[role=alert]');assert.ok(alert?.textContent.includes('This media could not be added'),'canonical lookup failure survives replacement listing');assert.equal(button('Add to conversation').disabled,false,'the pending basket can be retried');assert.equal(w.selected.length,0);
 if(outcome==='lookup-retry'||outcome==='lookup-retry-denied'){
 if(outcome==='lookup-retry-denied'){
 await w.fx.act(async()=>button('Add to conversation').click());await settle(()=>lookups===2&&!!w.document.querySelector('[role=alert]'),'retry refusal settles');assert.equal(w.selected.length,0);assert.equal(button('Add to conversation').disabled,false,'retry retains the captured reference');
 }
 await w.fx.act(async()=>button('Add to conversation').click());await settle(()=>w.selected.length===1&&!!w.document.querySelector('.compact-media-check input'),'explicit retry inserts once and replacement settles');assert.equal(writes,1,'retry only finishes canonical lookup and never re-saves');assert.equal(w.selected[0].assetId,'ma_'+'a'.repeat(32));assert.ok(!w.document.querySelector('[role=alert]'));return;
 }
 if(outcome==='lookup-context'){
 await w.fx.act(async()=>{w.purpose='timeline';w.fx.render()});await settle(()=>!!w.document.querySelector('.compact-media-check input'),'new insertion context settles');assert.ok(!w.document.querySelector('[role=alert]'),'old insertion failure cannot follow a context change');return;
 }
 if(outcome==='lookup-filter'){
 await source('recent');await settle(()=>!!w.document.querySelector('.compact-media-check input'),'new filter scope settles');assert.ok(w.document.querySelector('[role=alert]'),'browse filters preserve recoverable failure and captured choice');assert.equal(w.document.querySelectorAll('[data-basket-item]').length,1);return;
 }
 await w.fx.act(async()=>{w.owner='B';w.fx.render()});await settle(()=>w.reader.assets[0]?.id==='B-new'&&!w.document.querySelector('dialog [role=status]'),'B replacement settles');assert.ok(!w.document.querySelector('[role=alert]'),'A failure never transfers to B');
 }

 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
