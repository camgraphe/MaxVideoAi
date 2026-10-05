import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {parseStudioLiveRequests,readStudioLiveQueue,type StudioLiveRequest} from '../scripts/qa/studio-live-queue';

const first:StudioLiveRequest={id:'first',model:'gpt-6.1-sol',message:'Prepare a watch image.',referenceKeys:['watch']};
const last:StudioLiveRequest={id:'last',model:'gpt-6-luna',message:'Help me choose a direction.'};
async function fixture(t:{after(callback:()=>Promise<void>):void}) {
  const directory=await mkdtemp(join(tmpdir(),'studio-live-queue-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const path=join(directory,'requests.json');
  await writeFile(path,JSON.stringify([first]));
  return path;
}

test('the final appended batch is processed before an already present done marker closes the queue',async t=>{
  const path=await fixture(t);
  await writeFile(path,JSON.stringify([first,last]));
  await writeFile(path+'.done','');
  const pending=await readStudioLiveQueue(path,[first],1);
  assert.equal(pending.drained,false);
  assert.deepEqual(pending.requests,[first,last]);
  const completed=await readStudioLiveQueue(path,pending.requests,2);
  assert.equal(completed.drained,true);
});

test('a producer append and done arriving after the queue read cannot cause premature completion',async t=>{
  const path=await fixture(t);
  const raced=await readStudioLiveQueue(path,[first],1,async(file,encoding)=>{
    const value=await readFile(file,encoding);
    if(file===path) {
      await writeFile(path,JSON.stringify([first,last]));
      await writeFile(path+'.done','');
    }
    return value;
  });
  assert.equal(raced.drained,false,'An earlier absent done marker cannot authorize closing from an older queue snapshot.');
  const pending=await readStudioLiveQueue(path,raced.requests,1);
  assert.equal(pending.drained,false);
  assert.deepEqual(pending.requests,[first,last]);
  assert.equal((await readStudioLiveQueue(path,pending.requests,2)).drained,true);
});

test('an exhausted queue stays open until its producer marks completion',async t=>{
  const path=await fixture(t);
  assert.deepEqual(await readStudioLiveQueue(path,[first],1),{requests:[first],drained:false});
});

test('refresh rejects modifications, reordering or removal of any previously observed request',async t=>{
  const path=await fixture(t);
  await writeFile(path+'.done','');
  for(const changed of [
    [{...first,message:'Changed brief'},last],
    [{...first,model:'gpt-6-luna'},last],
    [{...first,referenceKeys:['portrait']},last],
    [last,first],
    [first],
  ]) {
    await writeFile(path,JSON.stringify(changed));
    await assert.rejects(readStudioLiveQueue(path,[first,last],2),/append-only/);
  }
});

test('initial and appended requests reject malformed arrays and reference selections',async t=>{
  const path=await fixture(t);
  for(const malformed of [null,{},[null],[{...first,id:1}],[{...first,message:[]}],[{...first,referenceKeys:'watch'}],[{...first,referenceKeys:[1]}]])
    assert.throws(()=>parseStudioLiveRequests(JSON.stringify(malformed)),/Invalid live requests/);
  await writeFile(path,JSON.stringify([first,{...last,model:'unsupported'}]));
  await assert.rejects(readStudioLiveQueue(path,[first],1),/Invalid live requests/);
});

test('marker read failures other than absence stop the queue',async t=>{
  const path=await fixture(t);
  await assert.rejects(readStudioLiveQueue(path,[first],1,async(file,encoding)=>{
    if(file.endsWith('.done'))throw Object.assign(new Error('Marker inaccessible'),{code:'EACCES'});
    return readFile(file,encoding);
  }),{code:'EACCES'});
});
