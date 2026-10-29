import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { NextRequest } from 'next/server';

test('common review scopes native evidence, audits reveals and preserves human annotation history', async t => {
  const api = await import('../frontend/server/admin-assistant-review/read-model').catch(() => null);
  assert.ok(api?.loadAssistantReviews, 'A common restricted read model is required');
  const pg = await startDisposablePostgres('assistant-review');
  const previous = process.env.DATABASE_URL; process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => { await getDb().end(); if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous; await pg.cleanup(); });
  assert.equal((await api.loadAssistantReviews({ source: 'composer' })).status, 'unavailable');
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,deleted_at timestamptz);
    CREATE TABLE studio_image_turns(user_id text,project_id text,request_id uuid,state text,created_at timestamptz,input_json jsonb,draft_json jsonb);
    CREATE TABLE studio_conversation_responses(user_id text,project_id text,request_id uuid,lease_id uuid,response_index int,state text,response_json jsonb,elapsed_ms int,created_at timestamptz);
    CREATE TABLE prompt_assistance_sessions(user_id text,id uuid,scope text);
    CREATE TABLE prompt_assistance_requests(user_id text,session_id uuid,request_id uuid,state text,model text,created_at timestamptz,input_json jsonb,context_json jsonb,reply_json jsonb,response_json jsonb,error text);
    CREATE TABLE mcp_generation_quotes(quote_id uuid,user_id text,auth_origin text,request_json jsonb,created_at timestamptz,state text,job_id text,catalog_revision text,price_cents int,currency text,oauth_client_id text);
    CREATE TABLE app_jobs(job_id text,user_id text,status text);`);
  const session = randomUUID(), id = randomUUID();
  const scope = { source: 'composer' as const, userId: 'owner', scopeId: session, requestId: id };
  for (const user of ['owner', 'foreign']) {
    await pg.pool.query('INSERT INTO prompt_assistance_sessions VALUES ($1,$2,\'video\')', [user, session]);
    await pg.pool.query(`INSERT INTO prompt_assistance_requests VALUES ($1,$2,$3,'complete','gpt-6.1-terra',now(),$4,$5,$6,$7,NULL)`, [user, session, id,
      { message: `${user} brief`, draft: { surface: 'video', engineId: 'seedance-2-5', text: 'Full original draft', settings: { durationSec: 8, audio: false }, references: [{ label: 'Image 1', ref: { id: 'asset-one' } }] } },
      { settings: { durationSec: 8 }, references: [{ label: 'Image 1', perception: { image: 'provided' } }], guide: { version: 'recorded-guide' }, reviewInput: { model: 'gpt-6.1-terra', reasoning: 'high' } },
      { reply: `${user} reply`, text: 'Full suggested prompt' }, { usage: { input_tokens: 123 }, output: [{ type: 'reasoning', encrypted_content: 'NEVER_REASONING' }] }]);
  }
  await assert.rejects(api.revealAssistantReview('reviewer', scope), { code: 'unavailable' });
  await pg.pool.query(readFileSync('neon/migrations/90_assistant_review.sql', 'utf8'));
  await pg.pool.query(readFileSync('neon/migrations/90_assistant_review.sql', 'utf8'));
  const list = await api.loadAssistantReviews({ source: 'composer', userId: 'owner' });
  assert.equal(list.status, 'available'); if (list.status !== 'available') throw new Error('Unavailable');
  assert.equal(list.items.length, 1); assert.equal(list.items[0].mediaModel, 'seedance-2-5');
  assert.doesNotMatch(JSON.stringify(list), /brief|reply|Full original|recorded-guide/);
  const detail = await api.revealAssistantReview('reviewer', scope);
  await assert.rejects(pg.pool.query("UPDATE prompt_assistance_requests SET context_json=jsonb_set(context_json,'{reviewInput}', '{}') WHERE user_id='owner'"), /immutable/);
  assert.equal(detail.message, 'owner brief'); assert.equal(detail.reply, 'owner reply'); assert.equal(detail.proposal, 'Full suggested prompt');
  assert.match(JSON.stringify(detail), /recorded-guide|durationSec|provided|123/);
  assert.doesNotMatch(JSON.stringify(detail), /foreign|NEVER_REASONING/);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM admin_assistant_review_access')).rows[0].n, 1);
  await assert.rejects(api.revealAssistantReview('reviewer', { ...scope, scopeId: randomUUID() }), { code: 'not_found' });
  const annotation = { ...scope, id: randomUUID(), verdict: 'needs_work' as const, issues: ['references'], note: 'Wrong lighting. https://private.test password=SECRET' };
  await api.annotateAssistantReview('reviewer', annotation);
  await api.annotateAssistantReview('reviewer', annotation);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM admin_assistant_review_annotations')).rows[0].n, 1, 'retry does not duplicate a review');
  await assert.rejects(api.annotateAssistantReview('reviewer', { ...annotation, note: 'Changed' }), { code: 'conflict' });
  const filtered = await api.loadAssistantReviews({ source: 'composer', userId: 'owner', verdict: 'needs_work', issue: 'references' });
  assert.equal(filtered.status, 'available'); if(filtered.status!=='available') throw new Error('Unavailable');
  assert.equal(filtered.items.length,1); assert.equal(filtered.items[0].reviewVerdict,'needs_work');
  const reviewed = await api.revealAssistantReview('reviewer', scope);
  assert.equal(reviewed.annotations.items[0].verdict, 'needs_work');
  assert.doesNotMatch(JSON.stringify(reviewed.annotations), /private\.test|SECRET/);
  await api.annotateAssistantReview('reviewer', { ...annotation, id: randomUUID(), verdict: 'useful', issues: [], note: 'Reviewed again' });
  assert.equal((await api.revealAssistantReview('reviewer', scope)).annotations.items.length, 2);
  const resolved = await api.loadAssistantReviews({ source: 'composer', userId: 'owner', verdict: 'needs_work' });
  assert.equal(resolved.status,'available'); if(resolved.status==='available') assert.equal(resolved.items.length,0,'Only the latest review determines the current filter');
  await assert.rejects(pg.pool.query('UPDATE admin_assistant_review_annotations SET verdict=\'useful\''), /append-only/);
  // Validated replies are deliberately absent on these failures; retained provider
  // evidence must still explain what the provider actually returned.
  for (const failure of [
    { error: 'OUTPUT_INVALID', status: 'completed', text: 'MALFORMED_JSON_REPLY', content: [{ type: 'output_text', text: 'MALFORMED_JSON_REPLY' }] },
    { error: 'OUTPUT_INCOMPLETE', status: 'incomplete', text: 'PARTIAL_REPLY', content: [{ type: 'output_text', text: 'PARTIAL_REPLY' }] },
    { error: 'OUTPUT_REFUSED', status: 'completed', text: '', content: [{ type: 'refusal', refusal: 'REFUSED_REPLY' }] },
  ]) {
    await pg.pool.query("UPDATE prompt_assistance_requests SET state='failed',reply_json=NULL,error=$1,response_json=$2 WHERE user_id='owner'", [failure.error, {
      status: failure.status, incomplete_details: { reason: 'max_output_tokens' }, output_text: failure.text,
      output: [{ type: 'message', content: failure.content }, { type: 'reasoning', summary: [{ text: 'NEVER_REASONING' }] }],
    }]);
    const failed = await api.revealAssistantReview('reviewer', scope);
    assert.equal(failed.reply, null);
    const raw = failed.evidence.find(entry => entry.title === 'Recorded provider output (may be rejected or incomplete)');
    assert.ok(raw, 'Failed replies need separately labeled provider output');
    assert.equal(raw.data.truncated, false, 'Absent optional response fields are missing, not oversized');
    assert.match(JSON.stringify(raw.data.value), new RegExp(failure.text || 'REFUSED_REPLY'));
    assert.match(JSON.stringify(raw.data.value), /max_output_tokens/);
    assert.doesNotMatch(JSON.stringify(raw), /NEVER_REASONING/);
  }
  await pg.pool.query("UPDATE prompt_assistance_requests SET response_json=$1 WHERE user_id='owner'", [{ status: 'completed', output_text: 'OVERSIZED_REPLY ' + 'a '.repeat(300000) }]);
  const oversized = await api.revealAssistantReview('reviewer', scope);
  const rawOversized = oversized.evidence.find(entry => entry.title === 'Recorded provider output (may be rejected or incomplete)');
  assert.equal(rawOversized?.data.truncated, true);
  assert.match(JSON.stringify(rawOversized?.data.value), /OVERSIZED_REPLY/);
  assert.ok(Buffer.byteLength(JSON.stringify(rawOversized)) < 170000);
  await pg.pool.query('DELETE FROM prompt_assistance_requests WHERE user_id=\'owner\'');
  await assert.rejects(api.revealAssistantReview('reviewer', scope), { code: 'not_found' });
  await assert.rejects(api.annotateAssistantReview('reviewer', { ...annotation, id: randomUUID() }), { code: 'not_found' });

  const quote = randomUUID();
  await pg.pool.query(`INSERT INTO mcp_generation_quotes VALUES ($1,'owner','oauth',$2,now(),'accepted','job-one','catalog-v1',100,'USD','client-one'),($3,'owner','studio-session',$2,now(),'prepared',NULL,'catalog-v1',100,'USD',NULL)`, [quote, { surface: 'video', engineId: 'wan-3', prompt: 'A bird', settings: { durationSec: 7 } }, randomUUID()]);
  await pg.pool.query("INSERT INTO app_jobs VALUES ('job-one','owner','failed')");
  const mcp = await api.loadAssistantReviews({ source: 'mcp' });
  assert.equal(mcp.status, 'available'); if (mcp.status !== 'available') throw new Error('Unavailable');
  assert.equal(mcp.items.length, 1); assert.equal(mcp.items[0].requestId, quote);
  const mcpDetail = await api.revealAssistantReview('reviewer', { source: 'mcp', userId: 'owner', scopeId: quote, requestId: quote });
  assert.equal(mcpDetail.reply, null); assert.match(JSON.stringify(mcpDetail.evidence), /failed|catalog-v1/);
  assert.match(mcpDetail.limitations.join(' '), /external|host/i);
  await pg.pool.query("INSERT INTO studio_projects VALUES ('film','owner',NULL),('deleted','owner',now())");
  await pg.pool.query(`INSERT INTO studio_image_turns VALUES ('owner','film',$1,'ready',now(),$2,$3),('owner','deleted',$1,'ready',now(),$2,$3)`, [id, { message: 'Studio brief', references: [] }, { reply: 'Studio reply' }]);
  const studio = await api.loadAssistantReviews({ source: 'studio' });
  assert.equal(studio.status, 'available'); if (studio.status !== 'available') throw new Error('Unavailable');
  assert.equal(studio.items.length, 1);
  await pg.pool.query('INSERT INTO studio_conversation_responses VALUES ($1,$2,$3,$4,0,$5,$6,123,now(),NULL)', ['owner', 'film', id, randomUUID(), 'complete', {
    status: 'completed', output: [{ type: 'function_call', name: 'image_prepare', arguments: 'BROKEN_TOOL_ARGUMENTS' }, { type: 'reasoning', summary: [{ text: 'NEVER_REASONING' }] }],
  }]);
  const studioDetail = await api.revealAssistantReview('reviewer', { source: 'studio', userId: 'owner', scopeId: 'film', requestId: id });
  assert.equal(studioDetail.message, 'Studio brief');
  const rawStudio = studioDetail.evidence.find(entry => entry.title === 'Recorded provider outputs (may be rejected or incomplete)');
  assert.ok(rawStudio, 'Studio validation failures need retained tool output');
  assert.match(JSON.stringify(rawStudio.data.value), /BROKEN_TOOL_ARGUMENTS/);
  assert.doesNotMatch(JSON.stringify(rawStudio), /NEVER_REASONING/);
  await assert.rejects(api.revealAssistantReview('reviewer', { source: 'studio', userId: 'owner', scopeId: 'deleted', requestId: id }), { code: 'not_found' });
  await pg.pool.query(`CREATE TABLE user_roles(user_id text,role text); INSERT INTO user_roles VALUES ('review-admin','admin'),('ordinary','user')`);
  const { POST } = await import('../frontend/app/api/admin/assistants/review/route');
  const oldBypass = process.env.LOCAL_ADMIN_BYPASS, oldAdmin = process.env.LOCAL_ADMIN_BYPASS_USER_ID;
  process.env.LOCAL_ADMIN_BYPASS = '1'; process.env.LOCAL_ADMIN_BYPASS_USER_ID = 'review-admin';
  try {
    const request = () => new NextRequest('http://localhost/api/admin/assistants/review', { method: 'POST', headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json', cookie: 'mva_local_admin_bypass=1' }, body: JSON.stringify({ action: 'reveal', source: 'studio', userId: 'owner', scopeId: 'film', requestId: id }) });
    assert.equal((await POST(request())).status, 200);
    process.env.LOCAL_ADMIN_BYPASS_USER_ID = 'ordinary';
    assert.equal((await POST(request())).status, 401, 'The real admin role gate also protects the shared reader');
  } finally {
    if (oldBypass === undefined) delete process.env.LOCAL_ADMIN_BYPASS; else process.env.LOCAL_ADMIN_BYPASS = oldBypass;
    if (oldAdmin === undefined) delete process.env.LOCAL_ADMIN_BYPASS_USER_ID; else process.env.LOCAL_ADMIN_BYPASS_USER_ID = oldAdmin;
  }
  await pg.pool.query(`INSERT INTO prompt_assistance_requests SELECT 'owner',$1,md5(i::text)::uuid,'complete','gpt-6-luna',now()-(i||' minute')::interval,$2,NULL,NULL,NULL,NULL FROM generate_series(1,60) i`, [session, { message: 'NEVER_LIST_CONTENT', draft: { surface: 'image', engineId: 'flux-2' } }]);
  const first = await api.loadAssistantReviews({ source: 'composer', userId: 'owner', scopeId: session, limit: 25 });
  const next = await api.loadAssistantReviews({ source: 'composer', userId: 'owner', scopeId: session, limit: 25, page: 1 });
  assert.equal(first.status,'available'); assert.equal(next.status,'available');
  if(first.status==='available'&&next.status==='available') {
    assert.equal(first.items.length,25); assert.equal(first.hasMore,true);
    assert.equal(new Set([...first.items,...next.items].map(row=>row.requestId)).size,50);
    assert.ok(first.items[0].createdAt < first.items[24].createdAt);
    assert.doesNotMatch(JSON.stringify(first),/NEVER_LIST_CONTENT/);
  }
});
