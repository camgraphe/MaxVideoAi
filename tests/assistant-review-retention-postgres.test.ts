import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';

test('review expiry removes only aged review copies, preserves native records and cannot be bypassed by retries', async t => {
  const retention = await import('../frontend/server/admin-assistant-review/retention').catch(() => null);
  assert.ok(retention?.cleanupAssistantReviewContext, 'Review retention must be implemented');
  const pg = await startDisposablePostgres('review-retention');
  const previous = process.env.DATABASE_URL; process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => { await getDb().end(); if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; await pg.cleanup(); });
  await pg.pool.query(`
    CREATE TABLE prompt_assistance_sessions(user_id text,id uuid,scope text);
    CREATE TABLE prompt_assistance_requests(user_id text,session_id uuid,request_id uuid,state text,model text,created_at timestamptz,input_json jsonb,context_json jsonb,reply_json jsonb,response_json jsonb,error text,PRIMARY KEY(user_id,session_id,request_id));
    CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,deleted_at timestamptz);
    CREATE TABLE studio_image_turns(user_id text,project_id text,request_id uuid,state text,created_at timestamptz,input_json jsonb,draft_json jsonb);
    CREATE TABLE studio_conversation_responses(user_id text,project_id text,request_id uuid,lease_id uuid,response_index int,state text,response_json jsonb,elapsed_ms int,created_at timestamptz,PRIMARY KEY(user_id,project_id,request_id,lease_id,response_index));
    CREATE TABLE mcp_generation_quotes(quote_id uuid,user_id text,auth_origin text,request_json jsonb,created_at timestamptz,state text,job_id text,catalog_revision text,price_cents int,currency text,oauth_client_id text);
  `);
  await pg.pool.query(readFileSync('neon/migrations/90_assistant_review.sql', 'utf8'));
  const session = randomUUID(), request = randomUUID(), lease = randomUUID();
  // Seed historical rows before installing the new no-repopulation guard.
  for (const [owner, hours] of [['expired', 2184], ['boundary', 2160], ['recent', 2136]] as const) {
    await pg.pool.query("INSERT INTO prompt_assistance_sessions VALUES($1,$2,'video')", [owner,session]);
    await pg.pool.query(`INSERT INTO prompt_assistance_requests VALUES($1,$2,$3,'unknown','model',clock_timestamp()-$4*interval '1 hour',$5,$6,$7,$8,'retained failure')`,
      [owner,session,request,hours,{message:'Original input',draftRevision:7},{maxChars:20000,guide:{version:'keep'},reviewInput:{private:'review copy'}},{reply:'Original reply'},{id:'provider-response',usage:{input_tokens:31}}]);
    await pg.pool.query('INSERT INTO studio_projects VALUES($1,$1,NULL)', [owner]);
    await pg.pool.query(`INSERT INTO studio_image_turns VALUES($1,$1,$2,'ready',clock_timestamp()-$3*interval '1 hour',$4,$5)`, [owner,request,hours,{message:'Original Studio history'},{reply:'Original Studio reply'}]);
    await pg.pool.query(`INSERT INTO studio_conversation_responses VALUES($1,$1,$2,$3,0,'reported',$4,123,clock_timestamp()-$5*interval '1 hour',$6)`, [owner,request,lease,{id:'studio-response',usage:{input_tokens:12}},hours,{private:'Studio review copy'}]);
    await pg.pool.query(`INSERT INTO admin_assistant_review_annotations VALUES($1,'reviewer','composer',$2,$3,$4,'needs_work','["context"]','Private reviewer note',clock_timestamp()-$5*interval '1 hour')`, [randomUUID(),owner,session,request,hours]);
    await pg.pool.query(`INSERT INTO mcp_generation_quotes VALUES($1,$2,'oauth','{"prompt":"Original MCP request"}',clock_timestamp()-$3*interval '1 hour','prepared',NULL,'catalog',123,'USD','client')`, [randomUUID(),owner,hours]);
  }
  const migration = readFileSync('neon/migrations/91_assistant_review_retention.sql', 'utf8');
  await pg.pool.query(migration); await pg.pool.query(migration);
  const snapshot = async () => {
    const tables = ['prompt_assistance_requests','studio_conversation_responses','admin_assistant_review_annotations','studio_image_turns','mcp_generation_quotes','admin_assistant_review_access'];
    return Promise.all(tables.map(async table => (await pg.pool.query(`SELECT to_jsonb(t) data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows.map(r=>r.data)));
  };
  const before = await snapshot();
  assert.deepEqual(await retention.cleanupAssistantReviewContext({limit:1,dryRun:true}), {dryRun:true,composer:1,studio:1,notes:1,hasMore:true});
  assert.deepEqual(await snapshot(), before, 'Dry-run must not mutate any row');
  for (const limit of [0,501,1.5,NaN]) await assert.rejects(retention.cleanupAssistantReviewContext({limit}), /limit/i);
  const api = await import('../frontend/server/admin-assistant-review/read-model');
  for (const owner of ['expired','boundary']) {
    const composer = {source:'composer',userId:owner,scopeId:session,requestId:request};
    await assert.rejects(api.revealAssistantReview('reviewer',composer), {code:'review_expired',status:410});
    await assert.rejects(api.annotateAssistantReview('reviewer',{...composer,id:randomUUID(),verdict:'useful',issues:[],note:'Must not append'}), {code:'review_expired',status:410});
    await assert.rejects(api.revealAssistantReview('reviewer',{source:'studio',userId:owner,scopeId:owner,requestId:request}), {code:'review_expired',status:410});
    const quote = (await pg.pool.query('SELECT quote_id FROM mcp_generation_quotes WHERE user_id=$1',[owner])).rows[0].quote_id;
    await assert.rejects(api.revealAssistantReview('reviewer',{source:'mcp',userId:owner,scopeId:quote,requestId:quote}), {code:'review_expired',status:410});
  }
  assert.deepEqual(await snapshot(), before, 'Expired reads must neither expose nor audit content or append notes');
  assert.equal((await api.loadAssistantReviewItem({source:'composer',userId:'expired',scopeId:session,requestId:request})).state,'unknown');
  for (const sql of [
    "UPDATE prompt_assistance_requests SET context_json=context_json-'reviewInput' WHERE user_id='recent'",
    "UPDATE studio_conversation_responses SET review_context_json=NULL WHERE user_id='recent'",
    "UPDATE admin_assistant_review_annotations SET note='' WHERE user_id='recent'",
    "UPDATE prompt_assistance_requests SET created_at=clock_timestamp()-interval '100 days',context_json=context_json-'reviewInput' WHERE user_id='recent'",
    "UPDATE studio_conversation_responses SET created_at=clock_timestamp()-interval '100 days',review_context_json=NULL WHERE user_id='recent'",
    "UPDATE admin_assistant_review_annotations SET verdict='useful',note='' WHERE user_id='expired'",
    "UPDATE prompt_assistance_requests SET context_json=(context_json-'reviewInput') || '{\"maxChars\":1}' WHERE user_id='expired'",
    "UPDATE studio_conversation_responses SET review_context_json=NULL,response_json='{}' WHERE user_id='expired'",
  ]) await assert.rejects(pg.pool.query(sql));
  // A locked oldest row must not block another worker or cause collateral updates.
  const lock = await pg.pool.connect();
  await lock.query('BEGIN');
  await lock.query("SELECT 1 FROM prompt_assistance_requests WHERE user_id='expired' FOR UPDATE");
  try {
    const first = await retention.cleanupAssistantReviewContext({limit:1});
    assert.deepEqual(first,{dryRun:false,composer:1,studio:1,notes:1,hasMore:true});
    assert.ok((await pg.pool.query("SELECT context_json FROM prompt_assistance_requests WHERE user_id='expired'")).rows[0].context_json.reviewInput);
  } finally { await lock.query('ROLLBACK'); lock.release(); }
  const batches = await Promise.all([retention.cleanupAssistantReviewContext({limit:1}),retention.cleanupAssistantReviewContext({limit:1})]);
  assert.equal(batches.reduce((n,b)=>n+b.composer,0),1);
  assert.equal(batches.reduce((n,b)=>n+b.studio,0),1);
  assert.equal(batches.reduce((n,b)=>n+b.notes,0),1);
  assert.deepEqual(await retention.cleanupAssistantReviewContext(),{dryRun:false,composer:0,studio:0,notes:0,hasMore:false});
  const expected = structuredClone(before);
  for (const r of expected[0]) if (r.user_id!=='recent') delete r.context_json.reviewInput;
  for (const r of expected[1]) if (r.user_id!=='recent') r.review_context_json=null;
  for (const r of expected[2]) if (r.user_id!=='recent') r.note='';
  const canonical = (rows: unknown[][]) => rows.map(table=>table.map(row=>JSON.stringify(row)).sort());
  assert.deepEqual(canonical(await snapshot()),canonical(expected),'Original messages, recovery settings, supplier usage, identities, timestamps, verdicts and MCP requests survive unchanged');
  for (const sql of [
    "UPDATE prompt_assistance_requests SET context_json=context_json || '{\"reviewInput\":{}}' WHERE user_id='expired'",
    "UPDATE studio_conversation_responses SET review_context_json='{}' WHERE user_id='expired'",
    "UPDATE admin_assistant_review_annotations SET note='repopulated' WHERE user_id='expired'",
    "INSERT INTO studio_conversation_responses VALUES('old','old',gen_random_uuid(),gen_random_uuid(),0,'reported','{}',0,clock_timestamp()-interval '91 days','{}')",
  ]) await assert.rejects(pg.pool.query(sql));
  await pg.pool.query(`INSERT INTO admin_assistant_review_access VALUES(gen_random_uuid(),'reviewer','composer','expired',$1,$2,'reveal','v1',clock_timestamp()-interval '91 days')`,[session,request]);
  await assert.rejects(pg.pool.query("UPDATE admin_assistant_review_access SET projection_version='changed'"),/append-only/);
});
