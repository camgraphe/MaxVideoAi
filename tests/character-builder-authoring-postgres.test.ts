import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { hashCanonicalGenerationRequest, stableJson } from '../frontend/src/server/agent-api/generation-normalization';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { recastHarness } from './helpers/character-recast-harness';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { createCreatorGenerationService } from '../frontend/src/server/tools/creator-generation-service';
import { estimateImageGeneration } from '../frontend/src/server/images/estimate-image-generation';
import { saveStudioCharacterOutput } from '../frontend/server/character-studio/store';
import type { GenerationActor } from '../frontend/src/server/agent-api/generation-actor';

// These tests run the real quote transaction, canonical tariff, wallet reservation,
// provider continuation and saved-character store against disposable PostgreSQL.
// Only the supplier transport is replaced by the existing local provider harness.
test('Character authoring charges once, preserves the Builder recipe and forbids generic confirmation', async t => {
  let module: typeof import('../frontend/server/character-studio/authoring');
  try { module = await import('../frontend/server/character-studio/authoring'); }
  catch { assert.fail('The private Character Builder authoring adapter is required.'); }
  const owner = '00000000-0000-4000-8000-000000000091';
  const f = await recastHarness(t, { userId: owner });
  await f.pg.pool.query(readFileSync('neon/migrations/101_character_builder_quotes.sql', 'utf8'));
  await f.pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY)');
  await f.pg.pool.query('INSERT INTO profiles VALUES($1)', [owner]);
  for (const file of ['93_character_studio.sql', '94_character_studio_presentation.sql'])
    await f.pg.pool.query(readFileSync('neon/migrations/' + file, 'utf8'));
  await f.pg.pool.query('ALTER TABLE job_outputs ADD COLUMN storage_url text; ALTER TABLE job_outputs ADD COLUMN thumb_url text');
  const entry = getFalEngineById('nano-banana-2-1')!;
  const engine = entry.engine;
  const runtime = {
    listPublicEngines: async () => [{engine,surface:'image' as const,publicModes:['t2i','i2i'] as const,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}],
    resolveRequestExecutability: () => ({ executable:true, reason:'available' as const }),
  };
  const generation: typeof createCreatorGenerationService = (actor, options) => createCreatorGenerationService(actor, {
    ...options,
    prepareDependencies: { ...options.prepareDependencies, ...runtime },
    confirmDependencies: { ...options.confirmDependencies, ...runtime, submitPaidGeneration:f.provider.submit },
  });
  const actor = {userId:owner,authMethod:'oauth',clientId:'authoring-A',emailVerified:true} as const;
  const make = (identity: GenerationActor = actor, enabled = true) => module.createCharacterBuilderAuthoringService(identity, {
    executionEnabled:enabled, generation,
  });
  const input = {traits:{customDetailsDescription:'One small cheek freckle'},qualityMode:'final',formatMode:'4k'} as const;
  const prepared = await make().prepare(input);
  const quoteId = prepared.quoteId;
  const approval = {quoteId,confirmed:true as const,amountCents:prepared.amountCents,currency:prepared.currency};
  const price = await estimateImageGeneration({engineId:engine.id,mode:'t2i',resolution:'4k',aspectRatio:'4:5',numImages:1,referenceImageCount:0});
  assert.equal(prepared.amountCents,price.pricing.totalCents);
  assert.equal(prepared.recipe.surface,'character-builder');
  assert.equal(prepared.recipe.builder.traits.customDetailsDescription,'One small cheek freckle');
  assert.ok(await make().getQuote({quoteId}));
  assert.equal(await make().recover({quoteId}), null);
  await assert.rejects(generation(actor,{enabled:true}).confirm({quoteId,confirmed:true}));
  await assert.rejects(make().confirm({...approval,amountCents:approval.amountCents+1}));
  await assert.rejects(make(actor,false).confirm(approval));
  await assert.rejects(make().confirm({...approval,confirmed:false}));
  assert.equal((await f.receipts(quoteId)).length,0);
  for (const foreign of [{...actor,clientId:'authoring-B'}, {...actor,userId:'foreign'},
    {userId:owner,authMethod:'studio-session' as const,clientId:null,projectId:'A'}]) {
    assert.equal(await make(foreign).getQuote({quoteId}),null);
    await assert.rejects(make(foreign).confirm(approval));
  }
  const [first, second] = await Promise.all([make().confirm(approval),make().confirm(approval)]);
  assert.equal(first.jobId,second.jobId);
  assert.equal(first.jobId,quoteId);
  assert.equal(f.provider.calls(quoteId),1);
  assert.equal((await make(actor,false).confirm(approval)).jobId,quoteId);
  assert.equal((await make(actor,false).recover({quoteId}))?.jobId,quoteId);
  const [job] = (await f.pg.pool.query('SELECT surface,settings_snapshot,render_ids FROM app_jobs WHERE job_id=$1',[quoteId])).rows;
  assert.equal(job.surface,'character');
  assert.equal(job.settings_snapshot.surface,'character-builder');
  assert.equal(job.settings_snapshot.builder.formatMode,'4k');
  assert.equal(job.settings_snapshot.builder.traits.customDetailsDescription,'One small cheek freckle');
  const capture = f.provider.captures.find(capture=>capture.quoteId===quoteId)!;
  assert.equal(capture.options.jobSurface,'character');
  assert.deepEqual(capture.options.settingsSnapshot,job.settings_snapshot);
  const charge = (await f.receipts(quoteId)).filter(row=>row.type==='charge');
  assert.equal(charge.length,1);
  assert.equal(charge[0].amount_cents,prepared.amountCents);
  const saved = await saveStudioCharacterOutput(owner,{jobId:quoteId,imageUrl:job.render_ids[0].url,name:'Freckle'});
  assert.ok(saved.character.id);
  const identityAsset = f.id(9);
  await f.pg.pool.query('UPDATE media_assets SET source_job_id=$1,url=$2 WHERE public_id=$3',[quoteId,job.render_ids[0].url,identityAsset]);
  const look = await make().prepare({characterId:saved.character.id,traits:{customOutfitDescription:'A blue velvet jacket'}});
  assert.doesNotMatch(JSON.stringify(look), /cdn\.maxvideoai\.com/);
  assert.doesNotMatch(JSON.stringify(await make().getQuote({quoteId:look.quoteId})), /cdn\.maxvideoai\.com|reference_fingerprint|pricingSnapshot/);
  assert.equal(look.recipe.builder.referenceImages[0].assetId,identityAsset);
  assert.equal(look.recipe.builder.characterId,saved.character.id);
  assert.equal(look.recipe.builder.consistencyMode,'strict');
  assert.equal(look.recipe.builder.traits.customDetailsDescription,'One small cheek freckle');
  assert.equal(look.recipe.builder.traits.customOutfitDescription,'A blue velvet jacket');
  const lookJob = await make().confirm({quoteId:look.quoteId,confirmed:true,amountCents:look.amountCents,currency:look.currency});
  const [lookRow] = (await f.pg.pool.query('SELECT render_ids FROM app_jobs WHERE job_id=$1',[lookJob.jobId])).rows;
  const savedLook = await saveStudioCharacterOutput(owner,{jobId:lookJob.jobId,imageUrl:lookRow.render_ids[0].url,name:'Blue velvet'});
  assert.equal(savedLook.character.id,saved.character.id);
  assert.equal(savedLook.character.looks[0].name,'Blue velvet');
  for (const bad of [{referenceImages:[{url:'https://evil.example/image.png',role:'identity'}]},
    {selectedResultUrl:'https://evil.example/image.png'}, {generateCount:4},
    {referenceImages:[{assetId:f.id(3),role:'identity'}]}]) await assert.rejects(make().prepare(bad));
  const foreignAsset = await make().prepare({referenceImages:[{assetId:f.id(1),role:'identity'}]});
  await f.pg.pool.query('UPDATE media_assets SET user_id=$1 WHERE public_id=$2',['foreign',f.id(1)]);
  await assert.rejects(make().confirm({quoteId:foreignAsset.quoteId,confirmed:true,amountCents:foreignAsset.amountCents,currency:foreignAsset.currency}));
  assert.equal((await f.receipts(foreignAsset.quoteId)).length,0);
  await t.test('quote and immutable recipe binding roll back together',async()=>{
    const before=(await f.pg.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n;
    await assert.rejects(module.createCharacterBuilderAuthoringService(actor,{executionEnabled:true,generation,
      onQuotePrepared:async()=>{throw new Error('local journal unavailable');},
    }).prepare(input),/local journal unavailable/);
    assert.equal((await f.pg.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,before);
    await assert.rejects(f.pg.pool.query('UPDATE character_builder_quotes SET recipe_hash=$1 WHERE quote_id=$2',
      ['0'.repeat(64),quoteId]),/immutable/);
    await assert.rejects(make({...actor,emailVerified:false}).prepare(input),{code:'EMAIL_VERIFICATION_REQUIRED'});
  });
  await t.test('duplicate originals retain both recipe roles and one submitted image',async()=>{
    const duplicate=await make().prepare({referenceImages:[{assetId:identityAsset,role:'identity'},
      {assetId:identityAsset,role:'style'}]});
    assert.equal(duplicate.recipe.builder.referenceImages.length,2);
    assert.equal(duplicate.quote.summary.references.length,1);
    await make().confirm({quoteId:duplicate.quoteId,confirmed:true,amountCents:duplicate.amountCents,currency:duplicate.currency});
    assert.equal((f.provider.captures.find(capture=>capture.quoteId===duplicate.quoteId)!.body.imageUrls as string[]).length,1);
  });
  await t.test('project-scoped ambiguous submissions recover without another charge or provider call',async()=>{
    const studio={userId:owner,authMethod:'studio-session' as const,clientId:null,projectId:'project-A'};
    const prepared=await make(studio).prepare(input);
    const approval={quoteId:prepared.quoteId,confirmed:true as const,amountCents:prepared.amountCents,currency:prepared.currency};
    assert.equal(await make({...studio,projectId:'project-B'}).getQuote({quoteId:prepared.quoteId}),null);
    await assert.rejects(make({...studio,projectId:'project-B'}).confirm(approval));
    assert.equal(await make(actor).getQuote({quoteId:prepared.quoteId}),null);
    f.provider.plans.set(prepared.quoteId,'ambiguous');
    const first=await make(studio).confirm(approval);
    assert.equal(first.jobId,prepared.quoteId);
    assert.equal((await make(studio,false).recover({quoteId:prepared.quoteId}))?.jobId,first.jobId);
    assert.equal((await make(studio,false).confirm(approval)).jobId,first.jobId);
    assert.equal(f.provider.calls(prepared.quoteId),1);
    assert.equal((await f.receipts(first.jobId)).filter(row=>row.type==='charge').length,1);
  });
  await t.test('accepted historical recipes recover after the prompt builder changes',async()=>{
    const historyId=randomUUID();
    const [stored]=(await f.pg.pool.query(`SELECT q.request_json,q.pricing_snapshot,b.recipe,b.reference_fingerprint
      FROM mcp_generation_quotes q JOIN character_builder_quotes b USING(quote_id) WHERE q.quote_id=$1`,[quoteId])).rows;
    const recipe={...stored.recipe,prompt:'Previously accepted Builder prompt version'};
    const request={...stored.request_json,prompt:recipe.prompt};
    const requestHash=hashCanonicalGenerationRequest(request);
    const hash=createHash('sha256').update(stableJson(recipe)).digest('hex');
    const pricing={...stored.pricing_snapshot,canonicalPricing:{...stored.pricing_snapshot.canonicalPricing,
      meta:{...stored.pricing_snapshot.canonicalPricing.meta,characterBuilderRecipeHash:hash}}};
    await f.pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,surface,status,progress,engine_id,settings_snapshot,render_ids,
      final_price_cents,currency,payment_status) VALUES($1,$2,'character','completed',100,$3,$4,$5,$6,'USD','paid_wallet')`,
      [historyId,owner,engine.id,recipe,JSON.stringify(job.render_ids),prepared.amountCents]);
    await f.pg.pool.query(`INSERT INTO mcp_generation_quotes(quote_id,user_id,oauth_client_id,auth_origin,studio_project_id,
      request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,job_id,
      expires_at,claimed_at,created_at,updated_at)
      SELECT $1::uuid,user_id,oauth_client_id,auth_origin,studio_project_id,$2::jsonb,$3::text,catalog_revision,$4::jsonb,price_cents,currency,
        funding_mode,'prepared',NULL,expires_at,NULL,created_at,updated_at FROM mcp_generation_quotes WHERE quote_id=$5`,
      [historyId,request,requestHash,pricing,quoteId]);
    await f.pg.pool.query(`INSERT INTO character_builder_quotes(quote_id,user_id,request_hash,recipe_hash,reference_fingerprint,recipe)
      VALUES($1,$2,$3,$4,$5,$6)`,[historyId,owner,requestHash,hash,stored.reference_fingerprint,recipe]);
    await f.pg.pool.query("UPDATE mcp_generation_quotes SET state='claimed',job_id=$1::text,claimed_at=now(),updated_at=now() WHERE quote_id=$1::uuid",[historyId]);
    await f.pg.pool.query("UPDATE mcp_generation_quotes SET state='accepted',updated_at=now() WHERE quote_id=$1",[historyId]);
    assert.equal((await make(actor,false).getQuote({quoteId:historyId}))?.recipe.prompt,recipe.prompt);
    assert.equal((await make(actor,false).recover({quoteId:historyId}))?.jobId,historyId);
    assert.equal((await make(actor,false).confirm({quoteId:historyId,confirmed:true,
      amountCents:prepared.amountCents,currency:'USD'})).jobId,historyId);
    assert.equal(f.provider.calls(historyId),0);
  });
  await t.test('account restrictions and tariff changes refuse an unaccepted purchase',async()=>{
    const prepared=await make().prepare(input);
    const approval={quoteId:prepared.quoteId,confirmed:true as const,amountCents:prepared.amountCents,currency:prepared.currency};
    await f.pg.pool.query("INSERT INTO user_account_restrictions(user_id,reason) VALUES($1,'local-test')",[owner]);
    await assert.rejects(make().prepare(input),{code:'ACCOUNT_RESTRICTED'});
    await assert.rejects(make().confirm(approval),{code:'ACCOUNT_RESTRICTED'});
    await f.pg.pool.query('DELETE FROM user_account_restrictions WHERE user_id=$1',[owner]);
    await f.pg.pool.query('UPDATE app_customer_tariff_state SET revision=revision+1');
    await assert.rejects(make().confirm(approval));
    assert.equal((await f.receipts(prepared.quoteId)).length,0);
    assert.equal(f.provider.calls(prepared.quoteId),0);
  });

});
