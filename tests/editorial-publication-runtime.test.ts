import test from 'node:test';import assert from 'node:assert/strict';
import {command} from '../scripts/editorial/publication-runtime';
test('a killed remote subprocess retains an explicit timeout for uncertain-write recovery',async()=>{
 await assert.rejects(command(process.execPath,['-e','setTimeout(()=>{},10000)'],{timeout:30}),/timeout/i);
});

test('publication pause is re-read between operations and the trial end stops mutations',async t=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');const {join}=await import('node:path');const {tmpdir}=await import('node:os');
 const {assertPublicationAllowed}=await import('../scripts/editorial/publication-control');
 const root=mkdtempSync(join(tmpdir(),'publication-control-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'.local'));
 writeFileSync(join(root,'.local/editorial-trial.json'),JSON.stringify({enabled:true,startsAt:'2026-09-01',endsAt:'2026-10-21'}));
 assert.doesNotThrow(()=>assertPublicationAllowed(root,new Date('2026-09-21')));
 writeFileSync(join(root,'.local/bridge-paused'),'');assert.throws(()=>assertPublicationAllowed(root,new Date('2026-09-21')),/paused/);
 rmSync(join(root,'.local/bridge-paused'));assert.throws(()=>assertPublicationAllowed(root,new Date('2026-10-21')),/ended/);
});
