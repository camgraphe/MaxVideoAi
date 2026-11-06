import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { recastHarness } from './helpers/character-recast-harness';
import { prepareRecast } from '../frontend/server/character-studio/recast';
import { createCharacterStudioIntegration } from '../frontend/server/character-studio/integration';
import { createDefaultCharacterBuilderState } from '../frontend/src/lib/character-builder';
import { createAgentCharacterStudioService } from '../frontend/src/server/agent-api/character-studio';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { GenerationActor } from '../frontend/src/server/agent-api/generation-actor';

test('Recast spending denials use the MCP preview destination in preparation and confirmation', async t => {
  const f = await recastHarness(t);
  const principal = { userId: f.actor.userId, authMethod: 'oauth', clientId: 'preview-client', emailVerified: true } as const;
  const accountUrl = 'https://maxvideoai-env-character-studio-test-camgraphes-projects.vercel.app/account/connections';
  const preview = createAgentCharacterStudioService(principal, { accountUrl, executionEnabled: true }, (actor, options) =>
    createCharacterStudioIntegration(actor, {
      ...options, readiness: () => null, prepareDependencies: f.deps, generation: f.generation,
    }));
  const input = { ...f.input, resolution: '720p', aspectRatio: '9:16' } as const;
  const quote = await preview.prepareRecast(input);
  await f.pg.pool.query('UPDATE mcp_spending_limits SET per_generation_cents=1 WHERE user_id=$1', [principal.userId]);

  const denials = await Promise.allSettled([
    preview.prepareRecast(input),
    preview.confirmRecast({ ...f.approval(quote), confirmed: true, currency: 'USD' }),
    f.prepare(),
  ]);
  const actions = denials.map(denial => {
    assert.equal(denial.status, 'rejected');
    assert.ok(denial.reason instanceof AgentApiError);
    assert.equal(denial.reason.code, 'SPENDING_LIMIT_EXCEEDED');
    return denial.reason.nextAction;
  });
  assert.deepEqual(actions, [
    { type: 'open_url', url: `${accountUrl}?focus=mcp-spending` },
    { type: 'open_url', url: `${accountUrl}?focus=mcp-spending` },
    { type: 'open_url', url: 'https://maxvideoai.com/account/connections?focus=mcp-spending' },
  ]);
  assert.equal(f.provider.captures.length, 0);
  assert.deepEqual(await f.receipts(quote.quoteId), []);
  assert.throws(
    () => f.generation(principal, { enabled: true, accountUrl: 'https://maxvideoai-env-character-studio-test-camgraphes-projects.vercel.app.evil.example/account/connections' }),
    /trusted MaxVideoAI account URL/,
  );
});

test('shared Recast admission reports invalid quote versions and out-of-range cents as input errors', async t => {
  const f = await recastHarness(t);
  const service = createCharacterStudioIntegration(f.actor, {
    executionEnabled: true, readiness: () => null, prepareDependencies: f.deps, generation: f.generation,
  });
  const quote = await service.prepareRecast(f.input);
  const invalid = await Promise.allSettled([
    service.getRecastQuote({ quoteId: '00000000-0000-1000-8000-000000000001' }),
    service.recoverRecast({ quoteId: '00000000-0000-0000-0000-000000000000' }),
    service.confirmRecast({ ...f.approval(quote), amountCents: 2_147_483_648 }),
  ]);
  assert.deepEqual(invalid.map(result => result.status === 'rejected' && result.reason.code), [
    'PARAMETER_INVALID', 'PARAMETER_INVALID', 'PARAMETER_INVALID',
  ]);
  assert.equal(f.provider.captures.length, 0);
});

test('Character Recast shares passages and ×2 pricing while preserving transport scopes and recovery', async t => {
  const f = await recastHarness(t);
  const actors: GenerationActor[] = [f.actor,
    { userId: f.actor.userId, authMethod: 'oauth', clientId: 'client-A', emailVerified: true },
    { userId: f.actor.userId, authMethod: 'studio-session', clientId: null, projectId: 'project-A' }];
  const make = (actor: GenerationActor, enabled = true) => createCharacterStudioIntegration(actor, {
    executionEnabled: enabled, readiness: () => null, prepareDependencies: f.deps, generation: f.generation,
  });
  for (const actor of actors) {
    const service = make(actor);
    const quote = await service.prepareRecast({ ...f.input, video: f.video, audio: f.audio });
    assert.equal(quote.amountCents, 434);
    assert.equal(quote.quote.price.amountCents, 434);
    assert.equal(quote.sourceSeconds, 7.5);
    assert.equal(quote.audioSeconds, 5.25);
    assert.equal(quote.passages.video?.startSec, f.video.range.startSec);
    assert.equal(quote.passages.audio?.startSec, f.audio.range.startSec);
    const stored = await service.getRecastQuote({ quoteId: quote.quoteId });
    assert.ok(stored);
    assert.equal(stored.authOrigin, actor.authMethod);
    assert.equal(stored.oauthClientId, actor.clientId);
    assert.equal(stored.studioProjectId, actor.authMethod === 'studio-session' ? actor.projectId : null);
    assert.deepEqual(stored.request.references, [
      {kind:'asset', assetId:f.id(4), role:'source'},
      {kind:'asset', assetId:f.id(9), role:'reference', slot:0},
      {kind:'asset', assetId:f.id(5), role:'reference', slot:1},
    ]);
    assert.equal(await service.recoverRecast({ quoteId: quote.quoteId }), null);
    for (const other of actors.filter(other => other.authMethod !== actor.authMethod)) {
      assert.equal(await make(other).getRecastQuote({ quoteId: quote.quoteId }), null);
      await assert.rejects(make(other).confirmRecast(f.approval(quote)));
    }
    const foreign = actor.authMethod === 'oauth' ? { ...actor, clientId: 'client-B' }
      : actor.authMethod === 'studio-session' ? { ...actor, projectId: 'project-B' } : { ...actor, userId: 'foreign' };
    assert.equal(await make(foreign).getRecastQuote({ quoteId: quote.quoteId }), null);
    await assert.rejects(service.confirmRecast({ ...f.approval(quote), amountCents: 435 }));
    await assert.rejects(service.confirmRecast({ ...f.approval(quote), confirmed: false }));
    await assert.rejects(make(actor, false).confirmRecast(f.approval(quote)));
    const before = f.provider.captures.length;
    const [first, second] = await Promise.all([service.confirmRecast(f.approval(quote)), service.confirmRecast(f.approval(quote))]);
    assert.equal(first.jobId, second.jobId);
    assert.equal(f.provider.captures.length, before + 1);
    assert.equal((await make(actor, false).recoverRecast({ quoteId: quote.quoteId }))?.jobId, first.jobId);
    assert.equal((await make(actor, false).confirmRecast(f.approval(quote))).jobId, first.jobId);
    await assert.rejects(createCharacterStudioIntegration(actor, {
      executionEnabled:false, generationStatus:async () => null,
    }).recoverRecast({quoteId:quote.quoteId}), error => error instanceof Error && 'retryable' in error && error.retryable === true);
    assert.equal(f.provider.captures.length, before + 1);
    assert.equal((await f.receipts(first.jobId)).filter(row => row.type === 'charge').length, 1);
  }
  await assert.rejects(make(actors[1], false).prepareRecast(f.input));
  const recastForGeneric = await make(actors[1]).prepareRecast({...f.input, video:f.video, audio:f.audio});
  // The ordinary Wan confirmation path cannot purchase a fresh Recast product quote.
  await assert.rejects(f.generation(actors[1], {enabled:true}).confirm({quoteId:recastForGeneric.quoteId,confirmed:true}));
  await assert.rejects(createCharacterStudioIntegration(actors[1], {
    executionEnabled: true, readiness: () => 'ENGINE_UNAVAILABLE', prepareDependencies: f.deps,
  }).prepareRecast(f.input));
  const generic = await f.generation(actors[1], { enabled: true }).prepare({
    surface: 'video', engineId: 'wan-3-prime', mode: 'i2v', prompt: 'Ordinary model',
    references: [{ kind: 'asset', assetId: f.id(9), role: 'first_frame' }],
    settings: { durationSec: 8, resolution: '720p', aspectRatio: '9:16' },
  });
  assert.equal(await make(actors[1]).getRecastQuote({ quoteId: generic.quoteId }), null);
  await assert.rejects(make(actors[1]).confirmRecast({ quoteId: generic.quoteId, confirmed: true, amountCents: generic.price.amountCents, currency: 'USD' }));
});

test('Recast preparation exposes a canonical quote and journals atomically with its product binding', async t => {
  const f = await recastHarness(t);
  const actor = { ...f.actor, authMethod: 'studio-session' as const, projectId: 'project-journal' };
  const quote = await prepareRecast(actor, f.input, f.deps, { onQuotePrepared: async (stored, tx) => {
    const binding = await tx.query('SELECT quote_id FROM character_studio_recast_quotes WHERE quote_id=$1', [stored.quoteId]);
    assert.equal(binding.length, 1);
  } });
  assert.equal(quote.quote.quoteId, quote.quoteId);
  const before = (await f.pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n;
  await assert.rejects(prepareRecast(actor, f.input, f.deps, { onQuotePrepared: async () => { throw new Error('journal unavailable'); } }), /journal unavailable/);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n, before);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int AS n FROM character_studio_recast_quotes')).rows[0].n, before);
});

test('saved character and older named look resolve exact owned original without losing lineage or charging', async t => {
  const owner = '00000000-0000-4000-8000-000000000091';
  const f = await recastHarness(t, { userId: owner });
  await f.pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY)');
  await f.pg.pool.query('INSERT INTO profiles VALUES($1)', [owner]);
  for (const file of ['93_character_studio.sql', '94_character_studio_presentation.sql'])
    await f.pg.pool.query(readFileSync('neon/migrations/' + file, 'utf8'));
  await f.pg.pool.query('ALTER TABLE app_jobs ADD COLUMN IF NOT EXISTS hidden boolean; ALTER TABLE job_outputs ADD COLUMN storage_url text; ALTER TABLE job_outputs ADD COLUMN thumb_url text');
  const make = (actor: GenerationActor) => createCharacterStudioIntegration(actor, { executionEnabled: false });
  const service = make({ userId: owner, authMethod: 'oauth', clientId: 'character-client', emailVerified: true });
  const addJob = async (jobId: string, characterId?: string) => {
    const url = 'https://cdn.maxvideoai.com/' + jobId + '.png';
    const snapshot = { schemaVersion: 1, surface: 'character-builder', builder: { ...createDefaultCharacterBuilderState(), characterId }, prompt: 'Owned recipe' };
    await f.pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,status,engine_id,settings_snapshot,render_ids) VALUES($1,$2,'completed','nano-banana-2-1',$3,$4)`, [jobId, owner, snapshot, JSON.stringify([{ url }])]);
    const assetId = 'ma_' + (jobId === 'identity' ? 'a' : 'b').repeat(32);
    if (jobId === 'identity' || jobId === 'look-old') await f.pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,source_job_id) VALUES($1,$1,$2,'image',$3,'image/png',4096,720,1280,'ready',$4)`, [assetId, owner, url, jobId]);
    return { jobId, imageUrl: url, name: jobId };
  };
  const identity = await service.save({ ...await addJob('identity'), name: 'Basil' });
  const characterId = identity.character.id;
  const old = await service.save({ ...await addJob('look-old', characterId), name: 'Safran' });
  const lookId = old.character.looks[0].id;
  for (let n = 0; n < 25; n++) await service.save(await addJob('look-' + n, characterId));
  assert.equal((await service.list({ name: 'bAsIl' })).characters[0].id, characterId);
  assert.deepEqual((await service.list({ name: 'Absent' })).characters, []);
  assert.equal((await service.get({ characterId, lookName: 'safran' })).looks[0].id, lookId);
  const selected = await service.select({ characterId, lookId });
  assert.equal(selected.assetId, 'ma_' + 'b'.repeat(32));
  assert.equal(selected.jobId, 'look-old');
  assert.equal(selected.lookName, 'Safran');
  assert.equal((await service.select({ characterId })).assetId, 'ma_' + 'a'.repeat(32));
  const foreign = make({ userId: '00000000-0000-4000-8000-000000000092', authMethod: 'oauth', clientId: 'character-client', emailVerified: true });
  assert.deepEqual((await foreign.list({})).characters, []);
  await assert.rejects(foreign.select({ characterId, lookId }));
  await assert.rejects(service.select({ characterId, lookId: '99999999' }));
  await assert.rejects(service.save({ name: 'Forged', jobId: 'identity', imageUrl: 'https://cdn.maxvideoai.com/forged.png' }));
  await f.pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='look-old'");
  await assert.rejects(service.select({ characterId, lookId }));
  assert.equal((await f.pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n, 0);
});
