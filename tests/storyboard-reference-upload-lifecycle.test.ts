import assert from 'node:assert/strict';
import test from 'node:test';
import { mountStoryboard } from './helpers/storyboard-workspace-fixture';

async function upload(f:Awaited<ReturnType<typeof mountStoryboard>>,name:string){
  let pending:Promise<void>;
  await f.w.fx.act(async()=>{pending=f.w.builder.references.onFile(f.w.builder.references.field,new f.w.File(['image'],name,{type:'image/png'}),0);});
  await f.tick();
  return {pending:pending!,request:f.w.requests.filter((x:any)=>x.url==='/api/uploads/image').at(-1)};
}
const slot=(f:any)=>f.w.builder.references.assets[f.w.builder.references.field.id][0];

test('removing a reference retires its upload and a late success cannot recreate the slot',async()=>{
  const f=await mountStoryboard();try{
    const a=await upload(f,'a.png');
    await f.w.fx.act(async()=>f.w.builder.references.onRemove(f.w.builder.references.field,0));
    await f.respond(a.request,{ok:true,asset:{url:'https://example.invalid/a.png'}});await a.pending;
    assert.equal(slot(f),null);assert.equal(a.request.init.signal.aborted,true);
    assert.ok(f.w.revoked.includes('blob:a.png'));
  }finally{await f.close();}
});

for(const status of [200,500])test(`an old upload ${status} cannot overwrite the replacement reference or its error state`,async()=>{
  const f=await mountStoryboard();try{
    const a=await upload(f,'old.png');
    await f.w.fx.act(async()=>f.w.builder.references.onRemove(f.w.builder.references.field,0));
    const b=await upload(f,'new.png');
    await f.respond(b.request,{ok:true,asset:{url:'https://example.invalid/new.png'}});await b.pending;
    await f.respond(a.request,status===200?{ok:true,asset:{url:'https://example.invalid/old.png'}}:{ok:false,error:'Old upload failed'},status);await a.pending;
    assert.equal(slot(f).previewUrl,'blob:new.png');assert.equal(slot(f).status,'ready');assert.equal(f.w.builder.submission.error,null);
    await f.edit('Use latest reference');await f.w.fx.act(async()=>f.w.builder.submission.onGenerate());
    const payload=JSON.parse(f.w.requests.find((x:any)=>x.url==='/api/images/generate').init.body);
    assert.ok(payload.imageUrls.includes('https://example.invalid/new.png'));assert.ok(!payload.imageUrls.includes('https://example.invalid/old.png'));
  }finally{await f.close();}
});

test('selecting a library reference invalidates the upload that previously owned that slot',async()=>{
  const f=await mountStoryboard();try{
    const a=await upload(f,'old.png');
    await f.w.fx.act(async()=>f.w.builder.references.onOpenLibrary(f.w.builder.references.field,0));
    await f.w.fx.act(async()=>f.w.referenceLibrary.onSelect({id:'library',url:'https://example.invalid/library.png',thumbUrl:'https://example.invalid/library-thumb.png',kind:'image'}));
    await f.respond(a.request,{ok:true,asset:{url:'https://example.invalid/old.png'}});await a.pending;
    assert.equal(slot(f).previewUrl,'https://example.invalid/library.png');
  }finally{await f.close();}
});

test('a removed upload still preparing locally is never dispatched',async()=>{
  const f=await mountStoryboard();try{
    let resolveFile:(file:File)=>void=()=>{};f.w.prepareUpload=()=>new Promise(resolve=>resolveFile=resolve);
    const file=new f.w.File(['image'],'old.png',{type:'image/png'});let pending:Promise<void>;
    await f.w.fx.act(async()=>{pending=f.w.builder.references.onFile(f.w.builder.references.field,file,0);});
    await f.w.fx.act(async()=>f.w.builder.references.onRemove(f.w.builder.references.field,0));
    await f.w.fx.act(async()=>resolveFile(file));await f.tick();
    const requests=f.w.requests.filter((x:any)=>x.url==='/api/uploads/image');
    if(requests.length)await f.respond(requests[0],{ok:true,asset:{url:'https://example.invalid/old.png'}});
    await pending!;assert.equal(requests.length,0);assert.equal(slot(f),null);
  }finally{await f.close();}
});
