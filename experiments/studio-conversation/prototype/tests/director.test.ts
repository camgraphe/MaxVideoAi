import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {ProjectStore} from '../server/store';import {CommandService} from '../server/commands';import {Director} from '../server/director';
 test('director starts an explicit demo film, remembers references and never invents an unsupported action',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-director-'));try{
 const store=new ProjectStore(dir),p=await store.create(),director=new Director(new CommandService(store));
 const input={requestId:'brief',text:'Fais une pub parfum lumineuse d’une minute'};const result=await director.respond(p.id,input);assert.equal(result.project.jobs[0].params.buildFilm,true);assert.equal(result.project.messages[0].role,'user');
 const replay=await director.respond(p.id,input);assert.equal(replay.project.jobs.length,1);assert.equal(replay.project.messages.filter(m=>m.role==='user').length,1);
 const unknown=await director.respond(p.id,{requestId:'unknown',text:'Téléporte mon flacon sur Mars'});assert.equal(unknown.project.jobs.length,1);assert.match(unknown.project.messages.at(-1)!.text,/démonstration|import|comprends/i);
 const voice=await director.respond(p.id,{requestId:'voice',text:'Crée une voix : « Le soleil se pose sur la mer. »'});assert.equal(voice.project.jobs.at(-1)!.params.text,'Le soleil se pose sur la mer.');
 }finally{await rm(dir,{recursive:true,force:true});}});
