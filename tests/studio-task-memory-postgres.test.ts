import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {readStudioTaskMemory,recallStudioTaskMemory} from '../frontend/src/server/studio/tasks/memory';

test('authored project memory survives the recent window without a paid summarizer or foreign rows',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const initial=f.input('standard','A film about paper. No neon. Preserve the supplied soundtrack.');await service.enqueue(initial);
  await f.pool.query("UPDATE studio_tasks SET state='completed',phase='done' WHERE request_id=$1",[initial.requestId]);
  for(let n=0;n<35;n++)await f.pool.query('INSERT INTO studio_task_memory_notes(user_id,project_id,request_id,message,reference_ids) VALUES($1,$2,$3,$4,\'[]\')',[actor.userId,actor.projectId,randomUUID(),'Another discussion '+n]);
  await f.pool.query('INSERT INTO studio_task_memory_notes(user_id,project_id,request_id,message,reference_ids) VALUES($1,$2,$3,$4,\'[]\')',[actor.userId,actor.projectId,randomUUID(),'Change the soundtrack only after explicit confirmation.']);
  const foreign=await f.actor();await createStudioTaskService(foreign,{enabled:true,assistancePolicy:f.policy}).enqueue(f.input('quick','Secret other-account soundtrack.'));
  const notes=await readStudioTaskMemory(actor,'soundtrack',randomUUID());
  assert.ok(notes.some(note=>note.message.includes('No neon')));assert.ok(notes.some(note=>note.message.includes('explicit confirmation')));
  assert.equal(notes.length<=4,true);assert.equal(notes.some(note=>note.message.includes('other-account')),false);
  const recalled=await recallStudioTaskMemory(actor,'soundtrack');assert.ok(recalled.some(note=>note.message.includes('supplied soundtrack')));
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0);
});
