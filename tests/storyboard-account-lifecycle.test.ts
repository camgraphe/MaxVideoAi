import assert from 'node:assert/strict';
import test from 'node:test';
import { mountStoryboard } from './helpers/storyboard-workspace-fixture';

const generated = {ok:true,mode:'i2i',jobId:'A-board',images:[{url:'https://example.invalid/A-board.png',width:1920,height:1080}],pricing:{totalCents:42,currency:'USD'}};

test('Storyboard discards private brief, selected media and history on A to B and logout', async()=>{
  const f=await mountStoryboard();
  try{
    await f.edit('Private A brief');
    await f.w.fx.act(async()=>f.w.resultPanel.onSelectRecentOutput(f.w.resultPanel.recentOutputs[0]));
    await f.auth('account-B');
    assert.equal(f.w.builder.prompt.subject,'');
    assert.equal(f.w.resultPanel.selectedImage,null);
    assert.deepEqual(Array.from(f.w.resultPanel.recentOutputs,(x:any)=>x.id),['account-B-output']);
    assert.ok(f.w.frames.filter((x:any)=>x.user==='account-B').every((x:any)=>!x.subject&&!x.history.includes('account-A-output')&&!x.selected));
    await f.edit('B brief');await f.auth(null);
    assert.equal(f.w.builder.prompt.subject,'');assert.equal(f.w.resultPanel.selectedImage,null);
    assert.equal(f.w.resultPanel.recentOutputs.length,0);
  }finally{await f.close();}
});

test('a late A history response cannot populate B or clear the newer B loading state', async()=>{
  const f=await mountStoryboard({holdHistory:true});
  try{
    const a=f.w.requests.find((x:any)=>x.url.includes('recent-outputs'));
    await f.auth('account-B');
    await f.respond(a,{ok:true,outputs:[{id:'A',jobId:'A',url:'https://example.invalid/A.png'}]});
    assert.equal(f.w.resultPanel.recentOutputs.length,0);
    assert.equal(f.w.resultPanel.recentOutputsLoading,true);
    const b=f.w.requests.filter((x:any)=>x.url.includes('recent-outputs')).at(-1);
    await f.respond(b,{ok:true,outputs:[{id:'B',jobId:'B',url:'https://example.invalid/B.png'}]});
    assert.deepEqual(Array.from(f.w.resultPanel.recentOutputs,(x:any)=>x.id),['B']);
    assert.equal(new Headers(a.init.headers).get('Authorization'),'Bearer token-account-A');
    assert.equal(a.init.signal.aborted,true);
  }finally{await f.close();}
});

test('late A board completion cannot populate B or start the included Kling request', async()=>{
  const f=await mountStoryboard();
  try{
    await f.edit('A scene');await f.w.fx.act(async()=>f.w.builder.target.onTargetChange('kling'));
    await f.w.fx.act(async()=>f.w.builder.submission.onGenerate());
    const a=f.w.requests.find((x:any)=>x.url==='/api/images/generate');assert.ok(a);
    await f.auth('account-B');await f.respond(a,generated);
    assert.equal(f.w.resultPanel.selectedImage,null);
    assert.equal(f.w.requests.filter((x:any)=>x.url==='/api/images/generate').length,1);
    assert.equal(new Headers(a.init.headers).get('Authorization'),'Bearer token-account-A');
    assert.equal(a.init.signal.aborted,true);
  }finally{await f.close();}
});

test('token refresh preserves the draft and selection but the next action uses the current explicit token',async()=>{
  const f=await mountStoryboard();
  try{
    await f.edit('Same-account brief');await f.w.fx.act(async()=>f.w.resultPanel.onSelectRecentOutput(f.w.resultPanel.recentOutputs[0]));
    const reads=f.w.requests.length;
    await f.auth('account-A',false,'refreshed-A');
    assert.equal(f.w.builder.prompt.subject,'Same-account brief');assert.ok(f.w.resultPanel.selectedImage);
    assert.equal(f.w.requests.length,reads);
    await f.w.fx.act(async()=>f.w.builder.submission.onGenerate());
    const a=f.w.requests.find((x:any)=>x.url==='/api/images/generate');
    assert.equal(new Headers(a.init.headers).get('Authorization'),'Bearer refreshed-A');
    await f.respond(a,generated);assert.equal(f.w.resultPanel.selectedImage.url,'https://example.invalid/A-board.png');
  }finally{await f.close();}
});

test('upload preparation started by A is not dispatched under B',async()=>{
  const f=await mountStoryboard();
  try{
    let prepared:(file:File)=>void=()=>{};f.w.prepareUpload=()=>new Promise(resolve=>prepared=resolve);
    const file=new f.w.File(['image'],'A.png',{type:'image/png'});let upload:Promise<void>;
    await f.w.fx.act(async()=>{upload=f.w.builder.references.onFile(f.w.builder.references.field,file,0);});
    await f.auth('account-B');await f.w.fx.act(async()=>prepared(file));await f.tick();
    const uploads=f.w.requests.filter((x:any)=>x.url==='/api/uploads/image');
    if(uploads.length)await f.respond(uploads[0],{ok:true,asset:{url:'https://example.invalid/A.png'}});
    await upload!;assert.equal(uploads.length,0);
    assert.equal(f.w.builder.references.assets[f.w.builder.references.field.id][0],null);
  }finally{await f.close();}
});


test('apply to generator writes a handoff only in the confirmed account namespace',async()=>{
  const f=await mountStoryboard();
  try{
    await f.w.fx.act(async()=>f.w.resultPanel.onSelectRecentOutput(f.w.resultPanel.recentOutputs[0]));
    await f.w.fx.act(async()=>f.w.resultPanel.onApplyToGenerator());
    const base='maxvideoai.storyboard.generatorHandoff.v1';
    assert.equal(f.w.sessionStorage.getItem(base),null);
    assert.equal(JSON.parse(f.w.sessionStorage.getItem(base+':account-A')).imageUrl,'https://example.invalid/account-A.png');
    await f.auth('account-B');assert.equal(f.w.resultPanel.selectedImage,null);
    assert.equal(f.w.sessionStorage.getItem(base+':account-B'),null);
  }finally{await f.close();}
});


test('a late included Kling frame cannot persist under B or dispatch a hide request',async()=>{
  const f=await mountStoryboard();
  try{
    await f.edit('Kling scene');await f.w.fx.act(async()=>f.w.builder.target.onTargetChange('kling'));
    await f.w.fx.act(async()=>f.w.builder.submission.onGenerate());
    const board=f.w.requests.find((x:any)=>x.url==='/api/images/generate');await f.respond(board,generated);
    const first=f.w.requests.filter((x:any)=>x.url==='/api/images/generate').at(-1);assert.notEqual(board,first);
    await f.auth('account-B');await f.respond(first,{...generated,jobId:'A-first',images:[{url:'https://example.invalid/A-first.png'}]});
    assert.equal(f.w.resultPanel.selectedImage,null);
    assert.equal(f.w.localStorage.length,0);
    assert.equal(f.w.requests.filter((x:any)=>x.init.method==='PATCH').length,0);
  }finally{await f.close();}
});

test('the normal Kling bundle generates, persists and hides only its own included first frame',async()=>{
  const f=await mountStoryboard();
  try{
    await f.edit('Kling scene');await f.w.fx.act(async()=>f.w.builder.target.onTargetChange('kling'));
    await f.w.fx.act(async()=>f.w.builder.submission.onGenerate());
    const board=f.w.requests.find((x:any)=>x.url==='/api/images/generate');
    assert.equal(JSON.parse(board.init.body).engineId,'gpt-image-2-6-sunburst');
    await f.respond(board,generated);
    const first=f.w.requests.filter((x:any)=>x.url==='/api/images/generate').at(-1);
    const framePayload=JSON.parse(first.init.body);
    assert.equal(framePayload.metadata.storyboard.parentJobId,'A-board');
    assert.equal(framePayload.jobId,'storyboard_kling_first_frame_A-board');
    assert.equal(framePayload.engineId,'gpt-image-2-6-sunburst');
    assert.equal(framePayload.imageUrls[0],generated.images[0].url);
    assert.equal(framePayload.resolution,'2048x1152');
    await f.respond(first,{...generated,jobId:'A-first',images:[{url:'https://example.invalid/A-first.png'}]});
    const hidden=f.w.requests.find((x:any)=>x.url==='/api/jobs/A-first');assert.ok(hidden);
    assert.equal(new Headers(hidden.init.headers).get('Authorization'),'Bearer token-account-A');
    await f.respond(hidden,{ok:true});
    assert.equal(f.w.resultPanel.klingFirstFrame.url,'https://example.invalid/A-first.png');
    assert.ok(f.w.localStorage.getItem('maxvideoai.storyboard.klingFirstFrames.v1:account-A'));
    assert.equal(f.w.builder.submission.running,false);
  }finally{await f.close();}
});

test('an edit on a historical board sends its original to Sunburst with the displayed quote', async () => {
  const f = await mountStoryboard();
  try {
    const original = f.w.resultPanel.recentOutputs[0];
    await f.w.fx.act(async () => f.w.resultPanel.onSelectRecentOutput(original));
    await f.w.fx.act(async () => f.w.resultPanel.onEditInstructionChange('Make the jacket blue'));
    assert.equal(f.w.resultPanel.editPricingReady, true);
    await f.w.fx.act(async () => f.w.resultPanel.onApplyEdit());
    const request = f.w.requests.find((x: { url: string }) => x.url === '/api/images/generate');
    const payload = JSON.parse(request.init.body);
    assert.equal(payload.engineId, 'gpt-image-2-6-sunburst');
    assert.equal(payload.source, 'storyboard_edit');
    assert.deepEqual(payload.imageUrls, [original.url]);
    assert.match(payload.prompt, /Make the jacket blue/);
    await f.respond(request, generated);
    assert.equal(f.w.resultPanel.editInstruction, '');
  } finally {
    await f.close();
  }
});

test('a recovered Kling board starts its included frame without resubmitting the paid board', async () => {
  const f = await mountStoryboard();
  try {
    await f.edit('Kling scene');
    await f.w.fx.act(async () => f.w.builder.target.onTargetChange('kling'));
    await f.w.fx.act(async () => f.w.builder.submission.onGenerate());
    const submissions = () => f.w.requests.filter((r: { url: string }) => r.url === '/api/images/generate');
    const jobId = JSON.parse(submissions()[0].init.body).jobId;
    await f.respond(submissions()[0], {
      ok: false, jobId, error: { code: 'provider_outcome_ambiguous', message: 'Awaiting recovery' },
    }, 503);
    const lookup = f.w.requests.find((r: { url: string }) => r.url === `/api/jobs/${jobId}`);
    assert.ok(lookup);
    assert.equal(new Headers(lookup.init.headers).get('Authorization'), 'Bearer token-account-A');
    assert.equal(submissions().length, 1);
    await f.respond(lookup, { ok: true, jobId, status: 'completed', imageRenders: generated.images, pricing: generated.pricing });
    assert.equal(submissions().length, 2);
    assert.equal(JSON.parse(submissions()[1].init.body).jobId, `storyboard_kling_first_frame_${jobId}`);
    assert.equal(f.w.resultPanel.selectedImage.url, generated.images[0].url);
  } finally {
    await f.close();
  }
});

test('a save started under A keeps its token and ignores a late failure under B',async()=>{
  const f=await mountStoryboard();
  try{
    await f.w.fx.act(async()=>f.w.resultPanel.onSelectRecentOutput(f.w.resultPanel.recentOutputs[0]));
    await f.w.fx.act(async()=>f.w.resultPanel.onSave());
    const save=f.w.requests.find((x:any)=>x.url==='/api/media-library/ensure');
    assert.equal(new Headers(save.init.headers).get('Authorization'),'Bearer token-account-A');
    await f.auth('account-B');await f.respond(save,{ok:false,error:'A save failed'},500);
    assert.equal(f.w.builder.submission.error,null);assert.equal(f.w.resultPanel.saving,false);
  }finally{await f.close();}
});

test('token renewal during the board and included-frame requests reaches subsequent same-account actions',async()=>{
  const f=await mountStoryboard();try{
    await f.edit('Kling scene');await f.w.fx.act(async()=>f.w.builder.target.onTargetChange('kling'));
    await f.w.fx.act(async()=>f.w.builder.submission.onGenerate());
    const board=f.w.requests.find((x:any)=>x.url==='/api/images/generate');
    await f.auth('account-A',false,'renewed-board-A');await f.respond(board,generated);
    const frame=f.w.requests.filter((x:any)=>x.url==='/api/images/generate').at(-1);
    assert.equal(new Headers(frame.init.headers).get('Authorization'),'Bearer renewed-board-A');
    await f.auth('account-A',false,'renewed-frame-A');await f.respond(frame,{...generated,jobId:'A-first'});
    const hide=f.w.requests.find((x:any)=>x.url==='/api/jobs/A-first');
    assert.equal(new Headers(hide.init.headers).get('Authorization'),'Bearer renewed-frame-A');
    await f.respond(hide,{ok:true});assert.equal(f.w.builder.submission.running,false);
  }finally{await f.close();}
});

test('upload dispatch after local preparation uses the renewed token of the same account',async()=>{
  const f=await mountStoryboard();try{
    let prepared:(file:File)=>void=()=>{};f.w.prepareUpload=()=>new Promise(resolve=>prepared=resolve);
    const file=new f.w.File(['image'],'reference.png',{type:'image/png'});let pending:Promise<void>;
    await f.w.fx.act(async()=>{pending=f.w.builder.references.onFile(f.w.builder.references.field,file,0);});
    await f.auth('account-A',false,'renewed-upload-A');await f.w.fx.act(async()=>prepared(file));await f.tick();
    const upload=f.w.requests.find((x:any)=>x.url==='/api/uploads/image');
    assert.equal(new Headers(upload.init.headers).get('Authorization'),'Bearer renewed-upload-A');
    await f.respond(upload,{ok:true,asset:{url:'https://example.invalid/reference.png'}});await pending!;
    assert.equal(f.w.builder.references.assets[f.w.builder.references.field.id][0].status,'ready');
  }finally{await f.close();}
});


test('unresolved authentication does not double initial estimates or retire a same-account draft during refresh',async()=>{
  const f=await mountStoryboard({userId:null,loading:true});try{
    const estimates=()=>f.w.requests.filter((r:any)=>r.url==='/api/images/estimate');
    assert.equal(estimates().length,0,'the loading shell must not mount guest pricing');
    await f.auth('account-A');assert.equal(estimates().length,3);
    await f.edit('Keep the current owned draft');
    await f.auth('account-A',true,'renewed-A');await f.auth('account-A',false,'renewed-A');
    assert.equal(f.w.builder.prompt.subject,'Keep the current owned draft');
    assert.equal(estimates().length,3,'same-account refresh must not remount pricing');
  }finally{await f.close();}
});
