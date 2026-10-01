import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {ProjectStore} from '../server/store';import {CommandService} from '../server/commands';import {mcp} from '../server/mcp';
 test('MCP discovery and editing use the exact durable UI commands, including replay and conflicts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-mcp-'));try{
 const store=new ProjectStore(dir),p=await store.create(),service=new CommandService(store),handle=mcp(service);
 await store.update(p.id,p=>{p.assets=[{id:'a',name:'Source',kind:'video',file:'a.mp4',duration:10,width:320,height:180,hasAudio:false,origin:'local'}];return p;});
 const inserted=await service.execute(p.id,{requestId:'insert',expectedRevision:0,command:{type:'insert',assetId:'a'}});const clipId=inserted.project.clips[0].id;
 const tools=await handle({jsonrpc:'2.0',id:1,method:'tools/list'});assert.ok(tools.result.tools.some((t:any)=>t.name==='studio_trim_clip'));
 const args={projectId:p.id,requestId:'cut',expectedRevision:1,clipId,inFrame:48,outFrame:144};
 const req={jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'studio_trim_clip',arguments:args}};
 const result=await handle(req);assert.equal(result.result.isError,undefined);assert.equal((await store.get(p.id)).clips[0].inFrame,48);
 await handle(req);assert.equal((await store.get(p.id)).revision,2);
 const stale=await handle({...req,id:3,params:{...req.params,arguments:{...args,requestId:'stale'}}});assert.equal(stale.result.isError,true);assert.match(stale.result.content[0].text,/révision/i);
 assert.equal(await handle({jsonrpc:'2.0',method:'notifications/initialized'}),undefined);
 }finally{await rm(dir,{recursive:true,force:true});}});
