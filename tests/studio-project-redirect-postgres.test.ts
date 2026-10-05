import assert from 'node:assert/strict';
import test from 'node:test';
import {startDisposablePostgres} from './helpers/disposable-postgres';

test('old project redirect lookup uses SELECT permission only and cannot expose foreign or legacy projects',async()=>{
  const database=await startDisposablePostgres('studio-redirect-read');
  try {
    await database.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,persistence_mode text,deleted_at timestamptz);
      INSERT INTO studio_projects VALUES('current','owner','connected',NULL),('foreign','other','connected',NULL),('old','owner','legacy',NULL),('deleted','owner','connected',NOW());
      CREATE ROLE redirect_reader; GRANT SELECT ON studio_projects TO redirect_reader;`);
    const module=await import('../frontend/src/server/studio/conversation-project-list');
    assert.equal(typeof module.readStudioConversationProjectId,'function');
    const client=await database.pool.connect();
    try {
      await client.query('SET ROLE redirect_reader');
      const executor={query:async(sql:string,values?:unknown[])=> (await client.query(sql,values)).rows};
      assert.equal(await module.readStudioConversationProjectId('owner','current',executor),'current');
      for(const id of ['foreign','old','deleted','missing'])assert.equal(await module.readStudioConversationProjectId('owner',id,executor),null);
    } finally {await client.query('RESET ROLE');client.release();}
  } finally {await database.cleanup();}
});
