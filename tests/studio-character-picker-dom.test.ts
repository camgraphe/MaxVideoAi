import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';

const modal='./app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageReferenceLibrary.client';
const endpoint='/api/studio/projects/film-a/characters';
const identity={jobId:'job-identity',imageUrl:'https://cdn.maxvideoai.com/identity.png',thumbUrl:'https://cdn.maxvideoai.com/identity-thumb.png'};
const look={id:'12',name:'Late night',jobId:'job-look',imageUrl:'https://cdn.maxvideoai.com/look.png',thumbUrl:'https://cdn.maxvideoai.com/look-thumb.png'};
const asset={assetId:'ma_11111111111111111111111111111111',kind:'image',name:'Vesper · Late night',url:look.imageUrl,thumbUrl:look.thumbUrl};
const selectedCharacter={id:'4',name:'Vesper',identity:{url:identity.imageUrl,thumbUrl:identity.thumbUrl},lookCount:1};
async function mount() {
  return mountToolFixture(`import {ImageReferenceLibrary} from '${modal}';
    function App(){return <ImageReferenceLibrary key={window.scope} accountKey={window.scope} characterProjectId={window.project}
      onClose={()=>{}} onSelect={asset=>window.selected.push(asset)} mediaEnabled/>}`,{
      './image-reference-library.module.css':'export default {}',
      '@/lib/owned-auth-fetch':'export const ownedAuthFetch=(url,accountKey,init)=>window.fixtureFetch(url,{...init,accountKey});',
      '@/components/library/LibraryImageThumbnail.client':'export const LibraryImageThumbnail=()=>null;',
    },w=>{w.scope='account-a';w.project='film-a';w.selected=[];w.fetch=w.fixtureFetch;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};});
}
async function click(f:Awaited<ReturnType<typeof mount>>,name:string) {
  const button=[...f.w.document.querySelectorAll('button')].find((item:any)=>item.textContent.trim()===name) as HTMLButtonElement|undefined;
  assert.ok(button,name);
  assert.equal(button.disabled,false);
  await f.act(async()=>button.click());
}
async function chooseLook(f:Awaited<ReturnType<typeof mount>>) {
  await click(f,'Saved characters');
  let request=f.w.requests.find((entry:any)=>entry.url===endpoint);
  assert.ok(request);
  await f.respond(request,{ok:true,result:{characters:[selectedCharacter],nextCursor:null}});
  await click(f,'Vesper');
  request=f.w.requests.find((entry:any)=>entry.url===endpoint+'?characterId=4');
  assert.ok(request);
  await f.respond(request,{ok:true,result:{...selectedCharacter,looks:[{...look,url:look.imageUrl}],nextLookCursor:null}});
  assert.equal(f.w.requests.filter((entry:any)=>entry.init.method==='POST').length,0,'Browsing must not promote or generate media');
  await click(f,'Late night');
  await click(f,'Add to conversation');
  request=f.w.requests.at(-1);
  assert.equal(request.url,endpoint);
  assert.equal(request.init.method,'POST');
  assert.equal(request.init.accountKey,'account-a');
  assert.deepEqual(JSON.parse(request.init.body),{characterId:'4',lookId:'12'});
  return request;
}
test('named Character look attaches its canonical original only after explicit selection',async()=>{
  const f=await mount();
  try {
    const request=await chooseLook(f);
    assert.equal(f.w.selected.length,0);
    await f.respond(request,{ok:true,result:asset});
    assert.deepEqual(JSON.parse(JSON.stringify(f.w.selected)),[asset]);
    assert.equal(f.w.requests.filter((entry:any)=>entry.init.method==='POST').length,1);
  } finally {await f.close();}
});
test('changing account and project aborts a pending Character attachment',async()=>{
  const f=await mount();
  try {
    const request=await chooseLook(f);
    f.w.scope='account-b';f.w.project='film-b';await f.render();
    assert.equal(request.init.signal.aborted,true);
    await f.respond(request,{ok:true,result:asset});
    assert.equal(f.w.selected.length,0);
  } finally {await f.close();}
});

test('Character search accepts part of a name and keeps that filter through pagination and clearing',async()=>{
  const f=await mount();
  try {
    await click(f,'Saved characters');
    await f.respond(f.w.requests.at(-1),{ok:true,result:{characters:[{...selectedCharacter,name:'Dixie Trouble'}],nextCursor:null}});
    const search=f.w.document.querySelector('input[aria-label="Character name"]');
    const submit=async(value:string)=>f.act(async()=>{
      Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype,'value')!.set!.call(search,value);
      search.dispatchEvent(new f.w.Event('input',{bubbles:true}));
    });
    await submit(' Dixie ');
    await click(f,'Search');
    let url=new URL(f.w.requests.at(-1).url,'https://app.invalid');
    assert.equal(url.searchParams.get('search'),'Dixie');
    assert.equal(url.searchParams.has('name'),false,'the browser search must not use the exact-name filter');
    await f.respond(f.w.requests.at(-1),{ok:true,result:{characters:[{...selectedCharacter,name:'Dixie Trouble'}],nextCursor:'4'}});
    await click(f,'Load more');
    url=new URL(f.w.requests.at(-1).url,'https://app.invalid');
    assert.equal(url.searchParams.get('search'),'Dixie');
    assert.equal(url.searchParams.get('cursor'),'4');
    await f.respond(f.w.requests.at(-1),{ok:true,result:{characters:[{...selectedCharacter,id:'3',name:'Older Dixie'}],nextCursor:null}});
    assert.match(f.w.document.body.textContent,/Dixie Trouble/);
    assert.match(f.w.document.body.textContent,/Older Dixie/);
    await submit('');
    await click(f,'Search');
    url=new URL(f.w.requests.at(-1).url,'https://app.invalid');
    assert.equal(url.search,'');
    assert.equal(f.w.requests.filter((entry:any)=>entry.init.method==='POST').length,0);
  } finally {await f.close();}
});
