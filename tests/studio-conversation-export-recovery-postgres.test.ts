import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startDisposablePostgres} from './helpers/disposable-postgres';

test('conversation render history recovers owned immutable artifacts across sequences without schema writes',async t => {
  const module = await import('../frontend/src/server/timeline-exports/repository');
  assert.ok(module.listStudioProjectTimelineExports);
  const pg = await startDisposablePostgres('stchat-exports');
  t.after(() => pg.cleanup());
  const executor = {query: async (sql: string,values?: readonly unknown[]) => (await pg.pool.query(sql,values as unknown[])).rows};
  for (const migration of ['26_studio_projects.sql','42_studio_connected_montages.sql']) await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  await pg.pool.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state) VALUES('film','owner','Film','minimal-start','{}','{}'),('private','foreign','Private','minimal-start','{}','{}');
    INSERT INTO studio_sequences(id,user_id,project_id,name) VALUES('main','owner','film','Main'),('other','owner','film','Other'),('private','foreign','private','Private');`);
  assert.deepEqual(await module.listStudioProjectTimelineExports({userId: 'owner',projectId: 'film'},executor),[]);
  assert.equal((await pg.pool.query("SELECT to_regclass('app_timeline_exports') AS name")).rows[0].name,null);
  await pg.pool.query(`CREATE TABLE app_timeline_exports(id text,user_id text,status text,progress int,message text,render_manifest jsonb,output_url text,output_asset_id text,output_size_bytes bigint,output_mime_type text,created_at timestamptz);
    INSERT INTO app_timeline_exports VALUES('ready','owner','completed',100,'Ready','{"sequenceId":"main","durationSec":3}','https://cdn.maxvideoai.com/film.mp4',NULL,100,'video/mp4',NOW()),('working','owner','rendering',20,NULL,'{"sequenceId":"other","durationSec":4}',NULL,NULL,NULL,NULL,NOW()),('private','foreign','completed',100,NULL,'{"sequenceId":"private"}','https://cdn.maxvideoai.com/private.mp4',NULL,100,'video/mp4',NOW());`);
  const history = await module.listStudioProjectTimelineExports({userId: 'owner',projectId: 'film'},executor);
  assert.equal(history.length,2);
  assert.equal(history.find((value: any) => value.id === 'ready')?.artifact?.outputUrl,'https://cdn.maxvideoai.com/film.mp4');
  assert.equal(history.find((value: any) => value.id === 'working')?.artifact,null);
  assert.deepEqual(await module.listStudioProjectTimelineExports({userId: 'owner',projectId: 'private'},executor),[]);
  assert.deepEqual(await module.listStudioProjectTimelineExports({userId: 'foreign',projectId: 'film'},executor),[]);
  await pg.pool.query("UPDATE studio_projects SET deleted_at=NOW() WHERE id='film'");
  assert.deepEqual(await module.listStudioProjectTimelineExports({userId: 'owner',projectId: 'film'},executor),[]);
});
