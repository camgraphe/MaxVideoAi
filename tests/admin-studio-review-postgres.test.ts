import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';

test('admin Studio review bounds metadata, scopes every read and fails closed without an access audit', async (t) => {
  const api = await import('../frontend/server/admin-studio-review/read-model').catch(() => null);
  assert.ok(api?.loadStudioReviewList, 'A bounded read model is required');
  const pg = await startDisposablePostgres('admin-studio-review');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => { await getDb().end(); if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; await pg.cleanup(); });
  assert.deepEqual(await api.loadStudioReviewList({}), { status: 'unavailable' });
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,deleted_at timestamptz);
    CREATE TABLE studio_image_turns(user_id text,project_id text,request_id uuid,state text,model_attempts int,created_at timestamptz,quote_id uuid,input_json jsonb,draft_json jsonb,PRIMARY KEY(user_id,project_id,request_id));
    INSERT INTO studio_projects VALUES ('film','owner',NULL),('other','owner',NULL),('private','foreign',NULL),('removed','owner',now());`);
  const id = randomUUID();
  for (const [user, project] of [['owner', 'film'], ['owner', 'other'], ['foreign', 'private'], ['owner', 'removed']]) {
    await pg.pool.query(`INSERT INTO studio_image_turns VALUES ($1,$2,$3,'ready',1,now(),NULL,$4,$5)`, [user, project, id, { message: `${project} brief https://signed.test?signature=SECRET` }, { reply: `${project} visible reply`, hidden: 'NEVER_DRAFT_EXTRA' }]);
  }
  await pg.pool.query(`INSERT INTO studio_image_turns SELECT 'owner','film',md5(i::text)::uuid,'failed',1,now()-(i ||' minute')::interval,NULL,'{}','{}' FROM generate_series(1,60) i`);
  const list = await api.loadStudioReviewList({ userId: 'owner', projectId: 'film' });
  assert.equal(list.status, 'available');
  if (list.status !== 'available') throw new Error('expected available');
  assert.equal(list.turns.length, 50); assert.equal(list.hasMore, true);
  assert.doesNotMatch(JSON.stringify(list), /brief|reply|signed\.test|input_json|draft_json/);
  assert.ok(list.turns.every(row => row.userId === 'owner' && row.projectId === 'film'));
  const scope = { userId: 'owner', projectId: 'film', requestId: id };
  await assert.rejects(api.revealStudioReview('admin', scope), { code: 'unavailable' });
  await pg.pool.query(readFileSync('neon/migrations/55_admin_studio_review_access.sql','utf8'));
  const review = await api.revealStudioReview('admin', scope);
  assert.equal(review.message, 'film brief [link removed]'); assert.equal(review.reply, 'film visible reply');
  assert.equal(review.actions.status, 'unavailable'); assert.equal(review.assistance.status, 'unavailable');
  assert.equal((await pg.pool.query('SELECT actor_id, user_id, project_id, request_id FROM admin_studio_review_access')).rows.length, 1);
  await assert.rejects(api.revealStudioReview('admin', { ...scope, userId: 'foreign' }), { code: 'not_found' });
  await assert.rejects(api.revealStudioReview('admin', { ...scope, projectId: 'removed' }), { code: 'not_found' });
  assert.equal((await pg.pool.query('SELECT * FROM admin_studio_review_access')).rows.length, 1);
  await pg.pool.query(`CREATE TABLE studio_conversation_steps(user_id text, project_id text, request_id uuid, call_id text, state text, action_json jsonb, result_json jsonb, observed_revision bigint, created_at timestamptz);
    CREATE TABLE studio_conversation_responses(user_id text,project_id text,request_id uuid,response_index int,state text,response_json jsonb,elapsed_ms int,created_at timestamptz);
    CREATE TABLE studio_image_model_usage(user_id text,project_id text,request_id uuid,state text,response_json jsonb,created_at timestamptz);`);
  for (const [user, project] of [['owner','film'],['owner','other'],['foreign','private']]) {
    await pg.pool.query(`INSERT INTO studio_conversation_steps VALUES ($1,$2,$3,'call','completed',$4,$5,4,now())`, [user,project,id,{ action: 'image.prepare', prompt: 'NEVER_PROMPT' }, {ok: true, data:{signedUrl:'https://NEVER_URL'}}]);
    await pg.pool.query(`INSERT INTO studio_conversation_responses VALUES ($1,$2,$3,0,'reported',$4,50,now())`, [user,project,id,{model:'gpt-6.1-sol',output:[{type:'reasoning',encrypted_content:'NEVER_REASONING'}],output_text:'NEVER_RAW_OUTPUT',usage:{input_tokens:120,output_tokens:30,total_tokens:150,output_tokens_details:{reasoning_tokens:10}}}]);
  }
  await pg.pool.query(readFileSync('neon/migrations/54_studio_assistance_ledger.sql','utf8'));
  await pg.pool.query(readFileSync('neon/migrations/62_studio_assistance_resolutions.sql','utf8'));
  await pg.pool.query(`INSERT INTO studio_assistance_accounts(user_id,sol_limit_nano_usd,luna_limit_nano_usd) VALUES ('owner',1000000,1000000);
    CREATE TABLE user_roles(user_id text,role text); INSERT INTO user_roles VALUES ('admin','admin'),('ordinary','user');`);
  await pg.pool.query(`INSERT INTO studio_assistance_turns(user_id,project_id,request_id,model,mode,policy_version,tariff_version,tariff_snapshot)
    VALUES ('owner','film',$1,'gpt-6.1-sol','included_sol','policy-v1','tariff-v1','{}')`,[id]);
  await pg.pool.query(`INSERT INTO studio_assistance_calls(id,user_id,project_id,request_id,lease_id,response_index,model,mode,policy_version,rate_version,tariff_version,state,input_token_bound,output_token_bound,reserved_nano_usd,reserved_cents)
    VALUES ($1,'owner','film',$2,$3,0,'gpt-6.1-sol','included_sol','policy-v1','rates-v1','tariff-v1','unknown',100,20,3000000,0)`,[randomUUID(),id,randomUUID()]);
  await pg.pool.query(`INSERT INTO studio_assistance_calls(id,user_id,project_id,request_id,lease_id,response_index,model,mode,policy_version,rate_version,tariff_version,state,input_token_bound,output_token_bound,reserved_nano_usd,reserved_cents,provider_min_nano_usd,provider_max_nano_usd,charged_cents,settled_at)
    VALUES ($1,'owner','film',$2,$3,1,'gpt-6.1-sol','included_sol','policy-v1','rates-v1','tariff-v1','settled',100,20,3000000,0,12000,18000,0,now())`,[randomUUID(),id,randomUUID()]);
  const full = await api.revealStudioReview('admin',scope);
  assert.equal(full.actions.items.length, 1); assert.equal(full.responses.items.length, 1);
  assert.equal(full.responses.items[0].inputTokens,120); assert.equal(full.responses.items[0].reasoningTokens,10);
  assert.equal(full.legacyUsage.status,'available'); assert.equal(full.legacyUsage.items.length,0);
  assert.doesNotMatch(JSON.stringify(full), /NEVER|signedUrl|encrypted|output_text|output_json/);
  assert.equal(full.coverage,'partial');
  assert.equal(full.assistance.items.length,2);
  assert.equal(full.assistance.items[0].chargedCents,null);
  assert.equal(full.assistance.items[0].providerMaxNanoUsd,null);
  assert.equal(full.assistance.items[1].chargedCents,0);
  assert.equal(full.assistance.items[1].providerMinNanoUsd,'12000');
  assert.equal(full.assistance.items[1].providerMaxNanoUsd,'18000');
  const { POST } = await import('../frontend/app/api/admin/studio/review/route');
  const previousBypass = process.env.LOCAL_ADMIN_BYPASS;
  const previousAdminId = process.env.LOCAL_ADMIN_BYPASS_USER_ID;
  process.env.LOCAL_ADMIN_BYPASS='1'; process.env.LOCAL_ADMIN_BYPASS_USER_ID='admin';
  try {
    const request = () => new NextRequest('http://localhost/api/admin/studio/review', { method:'POST',headers:{host:'localhost',origin:'http://localhost','content-type':'application/json',cookie:'mva_local_admin_bypass=1'},body:JSON.stringify(scope) });
    const response = await POST(request());
    assert.equal(response.status,200);
    assert.equal((await response.json()).detail.reply,'film visible reply');
    process.env.LOCAL_ADMIN_BYPASS_USER_ID='ordinary';
    assert.equal((await POST(request())).status,401, 'the real admin gate denies a configured local identity without an admin role');
  } finally {
    if(previousBypass===undefined) delete process.env.LOCAL_ADMIN_BYPASS; else process.env.LOCAL_ADMIN_BYPASS=previousBypass;
    if(previousAdminId===undefined) delete process.env.LOCAL_ADMIN_BYPASS_USER_ID; else process.env.LOCAL_ADMIN_BYPASS_USER_ID=previousAdminId;
  }
  await pg.pool.query(`INSERT INTO studio_conversation_steps SELECT 'owner','film',$1,'extra-'||i,'started','{}',NULL,4,now() FROM generate_series(1,25) i`,[id]);
  const bounded = await api.revealStudioReview('admin',scope);
  assert.equal(bounded.actions.items.length,20); assert.equal(bounded.actions.truncated,true);

  await pg.pool.query(`ALTER TABLE studio_conversation_steps DROP COLUMN result_json`);
  assert.equal((await api.revealStudioReview('admin',scope)).actions.status,'unavailable', 'partial schema drift does not pretend no actions exist');
});
