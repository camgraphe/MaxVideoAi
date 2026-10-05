import assert from 'node:assert/strict';
import test from 'node:test';
import {startDisposablePostgres} from './helpers/disposable-postgres';

test('private Canvas cleanup deletes only an exact unchanged unreferenced legacy plan',async()=>{
  const database=await startDisposablePostgres('canvas-retire');
  try {
    await database.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,persistence_mode text NOT NULL,workspace_state jsonb NOT NULL DEFAULT '{}');
      CREATE TABLE studio_sequences(id text PRIMARY KEY,user_id text,project_id text REFERENCES studio_projects(id) ON DELETE CASCADE);
      CREATE TABLE studio_assistance_calls(id text PRIMARY KEY,project_id text);
      CREATE TABLE media_assets(id text PRIMARY KEY,user_id text,url text);
      INSERT INTO studio_projects VALUES('old-a','owner','legacy','{"nodes":[1]}'),('old-b','owner','legacy','{}'),('new-chat','owner','connected','{"messages":[1]}'),('other-old','other','legacy','{}');
      INSERT INTO media_assets VALUES('asset','owner','original');`);
    const module=await import('../frontend/scripts/_lib/studio-private-canvas-cleanup').catch(()=>null);
    assert.ok(module?.previewPrivateCanvasCleanup,'explicit bounded cleanup owner must exist');
    const executor={query:async(sql:string,values?:unknown[])=> (await database.pool.query(sql,values)).rows};
    const plan=await module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old-a','old-b']});
    assert.equal((await database.pool.query('SELECT count(*)::int AS n FROM studio_projects')).rows[0].n,4,'preview is read-only');
    const client=await database.pool.connect();
    try {
      await client.query('BEGIN');
      const result=await module.applyPrivateCanvasCleanup({query:async(sql:string,values?:unknown[])=> (await client.query(sql,values)).rows},plan);
      assert.deepEqual(result.deletedIds,['old-a','old-b']);
      await client.query('COMMIT');
    } finally {client.release();}
    assert.deepEqual((await database.pool.query('SELECT id,workspace_state FROM studio_projects ORDER BY id')).rows,[{id:'new-chat',workspace_state:{messages:[1]}},{id:'other-old',workspace_state:{}}]);
    const repeatClient=await database.pool.connect();
    try {
      await repeatClient.query('BEGIN');
      const repeat=await module.applyPrivateCanvasCleanup({query:async(sql:string,values?:unknown[])=> (await repeatClient.query(sql,values)).rows},plan);
      assert.deepEqual(repeat,{deletedIds:[],alreadyDeleted:true});
      await repeatClient.query('COMMIT');
    } finally {repeatClient.release();}
    assert.deepEqual((await database.pool.query('SELECT * FROM media_assets')).rows,[{id:'asset',user_id:'owner',url:'original'}]);
    await assert.rejects(()=>module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['new-chat']}),/NOT_PRIVATE_CANVAS/);
    await assert.rejects(()=>module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['other-old']}),/NOT_PRIVATE_CANVAS/);
  } finally {await database.cleanup();}
});

test('cleanup rejects any referenced or changed project and rolls back the whole batch',async()=>{
  const database=await startDisposablePostgres('canvas-retire-guards');
  try {
    await database.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,persistence_mode text,workspace_state jsonb);
      CREATE TABLE studio_image_turns(project_id text,user_id text);
      INSERT INTO studio_projects VALUES('old-a','owner','legacy','{}'),('old-b','owner','legacy','{}');`);
    const module=await import('../frontend/scripts/_lib/studio-private-canvas-cleanup').catch(()=>null);
    assert.ok(module?.applyPrivateCanvasCleanup,'bounded cleanup implementation exists');
    const executor={query:async(sql:string,values?:unknown[])=> (await database.pool.query(sql,values)).rows};
    const plan=await module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old-a','old-b']});
    await database.pool.query("INSERT INTO studio_image_turns VALUES('old-b','owner')");
    await assert.rejects(()=>module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old-b']}),/CANVAS_REFERENCED/);
    const client=await database.pool.connect();
    try {
      await client.query('BEGIN');
      await assert.rejects(()=>module.applyPrivateCanvasCleanup({query:async(sql:string,values?:unknown[])=> (await client.query(sql,values)).rows},plan),/CANVAS_REFERENCED|CANVAS_CHANGED/);
      await client.query('ROLLBACK');
      assert.equal((await database.pool.query('SELECT count(*)::int AS n FROM studio_projects')).rows[0].n,2);
      await database.pool.query('DELETE FROM studio_image_turns');
      await database.pool.query("UPDATE studio_projects SET workspace_state='{\"changed\":true}' WHERE id='old-b'");
      await client.query('BEGIN');
      await assert.rejects(()=>module.applyPrivateCanvasCleanup({query:async(sql:string,values?:unknown[])=> (await client.query(sql,values)).rows},plan),/CANVAS_CHANGED/);
      await client.query('ROLLBACK');
      assert.equal((await database.pool.query('SELECT count(*)::int AS n FROM studio_projects')).rows[0].n,2);
    } finally {client.release();}
  } finally {await database.cleanup();}
});

test('cleanup includes only owned private sequences and protects their receipts and exports',async()=>{
  const database=await startDisposablePostgres('canvas-retire-sequences');
  try {
    await database.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,persistence_mode text,workspace_state jsonb);
      CREATE TABLE studio_sequences(id text PRIMARY KEY,user_id text,project_id text REFERENCES studio_projects(id) ON DELETE CASCADE,timeline_state jsonb);
      CREATE TABLE studio_project_commands(sequence_id text);
      CREATE TABLE app_timeline_exports(id text PRIMARY KEY,render_manifest jsonb);
      INSERT INTO studio_projects VALUES('old','owner','legacy','{}'),('new','owner','connected','{}');
      INSERT INTO studio_sequences VALUES('old-seq','owner','old','{"clips":[1]}'),('new-seq','owner','new','{}');`);
    const module=await import('../frontend/scripts/_lib/studio-private-canvas-cleanup');
    const executor={query:async(sql:string,values?:unknown[])=> (await database.pool.query(sql,values)).rows};
    const plan=await module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old']});
    assert.equal(plan.sequences.length,1);
    assert.equal(plan.sequences[0].id,'old-seq');
    await database.pool.query("INSERT INTO studio_project_commands VALUES('old-seq')");
    await assert.rejects(()=>module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old']}),/CANVAS_REFERENCED:studio_project_commands/);
    await database.pool.query('DELETE FROM studio_project_commands');
    await database.pool.query(`INSERT INTO app_timeline_exports VALUES('export','{"sequenceId":"old-seq"}')`);
    await assert.rejects(()=>module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old']}),/CANVAS_REFERENCED:app_timeline_exports/);
    await database.pool.query('DELETE FROM app_timeline_exports');
    await database.pool.query("UPDATE studio_sequences SET user_id='other' WHERE id='old-seq'");
    await assert.rejects(()=>module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old']}),/NOT_PRIVATE_CANVAS_SEQUENCE/);
    await database.pool.query("UPDATE studio_sequences SET user_id='owner',timeline_state='{\"changed\":true}' WHERE id='old-seq'");
    const client=await database.pool.connect();
    try {
      const dedicated={query:async(sql:string,values?:unknown[])=> (await client.query(sql,values)).rows};
      await client.query('BEGIN');
      await assert.rejects(()=>module.applyPrivateCanvasCleanup(dedicated,plan),/CANVAS_CHANGED/);
      await client.query('ROLLBACK');
      const fresh=await module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old']});
      await client.query('BEGIN');await module.applyPrivateCanvasCleanup(dedicated,fresh);await client.query('COMMIT');
      assert.deepEqual((await database.pool.query('SELECT id FROM studio_sequences ORDER BY id')).rows,[{id:'new-seq'}]);
      assert.deepEqual((await database.pool.query('SELECT id FROM studio_projects ORDER BY id')).rows,[{id:'new'}]);
    } finally {client.release();}
  } finally {await database.cleanup();}
});

test('a receipt committed between reference discovery and locks prevents the cleanup',async()=>{
  const database=await startDisposablePostgres('canvas-retire-race');
  try {
    await database.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,persistence_mode text,workspace_state jsonb);
      CREATE TABLE studio_assistance_calls(id text PRIMARY KEY,project_id text);
      INSERT INTO studio_projects VALUES('old','owner','legacy','{}');`);
    const module=await import('../frontend/scripts/_lib/studio-private-canvas-cleanup');
    const executor={query:async(sql:string,values?:unknown[])=> (await database.pool.query(sql,values)).rows};
    const plan=await module.previewPrivateCanvasCleanup(executor,{userId:'owner',projectIds:['old']});
    const client=await database.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      let inserted=false;
      const racing={query:async(sql:string,values?:unknown[])=>{
        const result=await client.query(sql,values);
        if(sql.includes('information_schema.columns')&&!inserted){
          inserted=true;
          await database.pool.query("INSERT INTO studio_assistance_calls VALUES('receipt','old')");
        }
        return result.rows;
      }};
      await assert.rejects(()=>module.applyPrivateCanvasCleanup(racing,plan),/CANVAS_REFERENCED|CANVAS_REQUIRES_READ_COMMITTED/);
      await client.query('ROLLBACK');
      // With locks and fresh READ COMMITTED snapshots, a concurrent writer must also be detected.
      await database.pool.query('DELETE FROM studio_assistance_calls');
      inserted=false;
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await assert.rejects(()=>module.applyPrivateCanvasCleanup(racing,plan),/CANVAS_REFERENCED/);
      await client.query('ROLLBACK');
      assert.equal((await database.pool.query('SELECT count(*)::int AS n FROM studio_projects')).rows[0].n,1);
      assert.equal((await database.pool.query('SELECT count(*)::int AS n FROM studio_assistance_calls')).rows[0].n,1);
    } finally {await client.query('ROLLBACK');client.release();}
  } finally {await database.cleanup();}
});
